import * as dgram from 'dgram'
import {existsSync, readFileSync} from 'fs'
import {createSigner} from 'http-message-signatures/lib/algorithm'
import {signMessage} from 'http-message-signatures/lib/httpbis'
import {SigningKey} from 'http-message-signatures/lib/types'
import {parse} from 'ini'
import * as net from 'net'
import {check} from 'tcp-port-used'
import WebSocket from 'ws'
import {
  CONNECT_TIMEOUT,
  DEFAULT_CREDENTIALS,
  DEFAULT_PING_INTERVAL,
  DEFAULT_PROFILE,
  DEFAULT_ROUTER,
  LOCALHOST,
  MAX_SCAN_PORT,
  MIN_SCAN_PORT,
  SIGNATURE_ALGORITHM,
  SIGNED_HEADERS,
  TARGET_REGEXP,
  USER_AGENT
} from './constants'

export interface WarpOptions {
  router: string                              // Remote.It WARP router hostname
  keyId: string                               // authentication key ID, defaults to process.env.R3_ACCESS_KEY_ID
  secret: string                              // authentication secret, defaults to process.env.R3_SECRET_ACCESS_KEY
  credentials: string                         // path to the Remote.It credentials file
  profile: string                             // credential profile name in the credentials file
  host: string                                // host to bind to, defaults to localhost
  port?: number                               // leave undefined to find an available port
  udp?: number                                // UDP proxy
  minPort: number                             // minimum port to scan
  maxPort: number                             // minimum port to scan
  headers: Record<string, string | string[]>  // optional headers
  pingInterval: number                        // ping interval, defaults to 60000 ms
}

const DEFAULT_OPTIONS: Partial<WarpOptions> = {
  router: DEFAULT_ROUTER,
  keyId: process.env.R3_ACCESS_KEY_ID,
  secret: process.env.R3_SECRET_ACCESS_KEY,
  credentials: DEFAULT_CREDENTIALS,
  profile: DEFAULT_PROFILE,
  host: LOCALHOST,
  minPort: MIN_SCAN_PORT,
  maxPort: MAX_SCAN_PORT,
  headers: {},
  pingInterval: DEFAULT_PING_INTERVAL
}

export class WarpProxy {
  private readonly url: URL
  private readonly options: WarpOptions
  private signature?: SigningKey | null
  private server?: net.Server
  private socket?: dgram.Socket

  constructor(target: string, options: Partial<WarpOptions> = {}) {
    this.options = {...DEFAULT_OPTIONS, ...options} as WarpOptions
    this.url = this.parseURL(target)
  }

  async open(): Promise<number> {
    this.signature = await this.getSignature()

    return this.options.udp ? this.udp() : this.tcp()
  }

  async close(): Promise<void> {
    await Promise.all([
      new Promise<void>((resolve, reject) => this.server?.close(error => error ? reject(error) : resolve())),
      new Promise<void>((resolve) => this.socket?.close(() => resolve()))
    ])
  }

  async tcp(): Promise<number> {
    const port = this.options.port || await this.getNextAvailablePort()

    if (!port) throw new Error(`no available port found`)

    this.server = net.createServer({noDelay: true})

    this.server
        .on('connection', socket => this.tunnel(socket))
        .on('error', (error: Error) => console.error(error))

    return new Promise<number>((resolve) => {
      this.server!.listen(port, this.options.host, () => resolve(port))
    })
  }

  async udp(): Promise<number> {
    const port = this.options.udp

    const map = new Map<string, WebSocket>()

    this.socket = dgram.createSocket('udp4')

    this.socket
        .on('error', (error: Error) => console.error(error))
        .on('close', () => {
          for (const ws of map.values()) ws.close() // close all open connections
        })
        .on('message', async (message: Buffer, remote: dgram.RemoteInfo) => {
          const key = `${remote.address}:${remote.port}`

          let ws = map.get(key)

          if (ws) {
            ws.send(message, {binary: true})
          } else {
            map.set(key, ws = await this.openTarget())

            ws.on('close', () => map.delete(key))
              .on('message', (data: Buffer) => this.socket!.send(data, remote.port, remote.address))
              .on('open', () => ws!.send(message, {binary: true}))
          }
        })

    return new Promise<number>((resolve) => {
      this.socket!.bind(port, this.options.host, () => resolve(port!))
    })
  }

  private async tunnel(client: net.Socket) {
    const ws = await this.openTarget()

    client.on('error', (error: Error) => console.error(error))
          .on('end', () => ws.close())
          .pause()

    ws.on('close', () => client.end())
      .on('message', (data: Buffer) => client.write(data))
      .on('open', () => {
        client.on('data', (data: Buffer) => ws.send(data, {binary: true}))
        client.resume()
      })
  }

  private async openTarget(): Promise<WebSocket> {
    const request = {
      method: 'GET',
      url: this.url,
      headers: {
        date: new Date().toUTCString(),
        'user-agent': USER_AGENT,
        ...this.options.headers || {}
      },
      perMessageDeflate: true,
      timeout: CONNECT_TIMEOUT
    }

    const signed = this.signature ? await signMessage(
      {
        key: this.signature,
        name: 'remoteit',
        fields: SIGNED_HEADERS
      },
      request
    ) : request

    const ws = new WebSocket(this.url, signed)

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping()  // Ping frame to keep the connection alive
    }, this.options.pingInterval)

    ws.on('error', (error: Error) => console.error(error))
      .on('close', () => clearInterval(ping))

    return ws
  }

  private parseURL(target: string): URL {
    if (!target) throw new Error(`Remote.It WARP target required`)

    const match = target.match(TARGET_REGEXP)

    if (!match) throw new Error(`Remote.It WARP target invalid: ${target}`)

    const {code, host} = match.groups || {}

    const domain = host || `${code.replace(/[^0-9a-z]+/ig, '').toLowerCase()}.${(this.options.router)}`

    return new URL(`https://${domain}`)
  }

  private async getSignature(): Promise<SigningKey | null> {
    if (this.options.headers?.authorization) return null // skip signature if authorization header is present

    let {keyId, secret} = this.options

    if (!keyId || !secret) {
      let {credentials, profile} = this.options

      if (!existsSync(credentials)) {
        console.error(`${credentials} not found, unauthenticated access`)

        return null
      }

      let hash = null

      try {
        hash = parse(readFileSync(credentials, 'utf-8'))
      } catch (error: any) {
        throw new Error(`Remote.It credentials file error: ${error.message}`)
      }

      const upper = profile?.toUpperCase()
      const fallback = !upper || upper === DEFAULT_PROFILE ? hash : undefined
      const section = Object.entries(hash).find(([key, _]) => key.toUpperCase() === upper)?.[1] || fallback

      if (!section) throw new Error(`Remote.It credential profile not found: ${profile}`);

      ({R3_ACCESS_KEY_ID: keyId, R3_SECRET_ACCESS_KEY: secret} = section)

      if (!keyId) throw new Error(`Remote.It credentials missing: R3_ACCESS_KEY_ID`)
      if (!secret) throw new Error(`Remote.It credentials missing: R3_SECRET_ACCESS_KEY`)
    }

    return createSigner(Buffer.from(secret, 'base64'), SIGNATURE_ALGORITHM, keyId)
  }

  private async getNextAvailablePort(): Promise<number | null> {
    const {host, minPort, maxPort} = this.options

    for (let port: number = minPort; port <= maxPort; port++) {
      if (!await check(port, host)) return port
    }

    return null
  }
}
