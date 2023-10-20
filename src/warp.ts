import {existsSync, readFileSync} from 'fs'
import {createSigner} from 'http-message-signatures/lib/algorithm'
import {signMessage} from 'http-message-signatures/lib/httpbis'
import {SigningKey} from 'http-message-signatures/lib/types'
import {parse} from 'ini'
import {createServer, Server, Socket} from 'net'
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
  private server!: Server

  constructor(target: string, options: Partial<WarpOptions> = {}) {
    this.options = {...DEFAULT_OPTIONS, ...options} as WarpOptions
    this.url = this.parseURL(target)
  }

  async open(): Promise<number> {
    this.server = createServer({noDelay: true})

    const port = this.options.port || await this.getNextAvailablePort()

    if (!port) throw new Error(`no available port found`)

    this.signature = await this.getSignature()

    return new Promise<number>((resolve, reject) => {
      this.server
          .on('connection', socket => this.tunnel(socket))
          .on('error', reject)
          .listen(port, () => resolve(port))
    })
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server?.close(error => error ? reject(error) : resolve())
    })
  }

  private async tunnel(client: Socket) {
    client.on('error', (error: Error) => console.error(error))

    const ws = await this.openTarget()

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping()  // Ping frame to keep the connection alive
    }, this.options.pingInterval)

    ws.on('error', (error: Error) => console.error(error))

    ws.on('close', () => {
      clearInterval(ping)
      client.end()
    })

    client.on('end', () => ws.close())

    client.pause()

    ws.on('open', () => {
      ws.on('message', (data: Buffer) => client.write(data))

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

    return new WebSocket(this.url, signed)
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
