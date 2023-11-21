import * as dgram from 'dgram'
import {signMessage} from 'http-message-signatures/lib/httpbis'
import * as net from 'net'
import {AddressInfo} from 'net'
import {check} from 'tcp-port-used'
import WebSocket from 'ws'
import {WarpClient} from './client'
import {
  CONNECT_TIMEOUT,
  LOCALHOST,
  MAX_SCAN_PORT,
  MIN_SCAN_PORT,
  PING_INTERVAL,
  SIGNED_HEADERS,
  USER_AGENT
} from './constants'

export interface ProxyOptions {
  bind: string                                // address to bind to, defaults to localhost
  port?: number                               // leave undefined to find an available port
  udp?: number                                // UDP proxy
  headers: Record<string, string | string[]>  // optional headers
  ping: number                                // ping interval, defaults to 60000 ms
}

const DEFAULT_OPTIONS: Partial<ProxyOptions> = {
  bind: LOCALHOST,
  ping: PING_INTERVAL
}

export class WarpProxy {
  private readonly client: WarpClient
  private readonly options: ProxyOptions
  private readonly url: URL
  private server?: net.Server
  private socket?: dgram.Socket

  constructor(client: WarpClient, target: string, options: Partial<ProxyOptions> = {}) {
    this.client = client
    this.options = {...DEFAULT_OPTIONS, ...options} as ProxyOptions
    this.url = this.parseURL(target)
  }

  get address(): AddressInfo {
    return this.server?.address() as AddressInfo || this.socket?.address() as AddressInfo
  }

  async open(): Promise<this> {
    this.options.udp ? await this.udp() : await this.tcp()

    return this
  }

  async close(): Promise<void> {
    await Promise.all([
      new Promise<void>((resolve, reject) => this.server?.close(error => error ? reject(error) : resolve())),
      new Promise<void>((resolve) => this.socket?.close(() => resolve()))
    ])
  }

  private async tcp(): Promise<number> {
    const port = this.options.port || await this.getNextAvailablePort()

    if (!port) throw new Error(`no available port found`)

    this.server = net.createServer({noDelay: true})

    this.server
        .on('connection', socket => this.tunnel(socket))
        .on('error', (error: Error) => console.error(error))

    return new Promise<number>((resolve) => {
      this.server!.listen(port, this.options.bind, () => resolve(port))
    })
  }

  private async udp(): Promise<number> {
    const port = this.options.udp

    const map = new Map<string, WebSocket>()

    this.socket = dgram.createSocket({type: 'udp4'})

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
              .on('open', () => {
                if (this.client.debug) console.error('WARP: connected UDP')

                ws!.send(message, {binary: true})
              })
          }
        })

    return new Promise<number>((resolve) => {
      this.socket!.bind(port, this.options.bind, () => resolve(port!))
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
        if (this.client.debug) console.error('WARP: connected TCP')

        client.on('data', (data: Buffer) => ws.send(data, {binary: true}))
        client.resume()
      })
  }

  private async openTarget(): Promise<WebSocket> {
    const headers = this.options.headers || {}

    let request = {
      method: 'GET',
      url: this.url,
      headers: {
        date: new Date().toUTCString(),
        'user-agent': USER_AGENT,
        ...headers
      },
      perMessageDeflate: true,
      timeout: CONNECT_TIMEOUT
    }

    if (!headers?.authorization) {
      const key = await this.client.getSignature()

      if (key) request = await signMessage({key, name: 'remoteit', fields: SIGNED_HEADERS}, request)
    }

    if (this.client.debug) console.error('WARP: opening %s', this.url)

    const ws = new WebSocket(this.url, request)

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping()  // Ping frame to keep the connection alive
    }, this.options.ping)

    ws.on('error', (error: Error) => console.error(error))
      .on('close', () => clearInterval(ping))

    return ws
  }

  private parseURL(target: string): URL {
    if (!target) throw new Error(`Remote.It WARP target required`)

    const subdomain = target.replace(/[^0-9a-z]+/ig, '').toLowerCase()

    return new URL(`https://${subdomain}.${this.client.router}`)
  }

  private async getNextAvailablePort(): Promise<number | null> {
    const {bind} = this.options

    for (let port: number = MIN_SCAN_PORT; port <= MAX_SCAN_PORT; port++) {
      if (!await check(port, bind)) return port
    }

    return null
  }
}
