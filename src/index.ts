import * as fs from 'fs'
import {createSigner} from 'http-message-signatures/lib/algorithm'
import {signMessage} from 'http-message-signatures/lib/httpbis'
import {SigningKey} from 'http-message-signatures/lib/types'
import * as https from 'https'
import * as ini from 'ini'
import {createServer, Server, Socket} from 'net'
import * as os from 'os'
import * as path from 'path'
import pump from 'pump'
import {Duplex} from 'stream'
import * as tcpPortUsed from 'tcp-port-used'
import websocketStream from 'websocket-stream'
import WebSocket from 'ws'

const TARGET_REGEXP = /^(?:(?<code>[\w-:]+)|([^:]+:\/\/)?(?<host>.+))$/

const SIGNATURE_ALGORITHM = 'hmac-sha256'
const SIGNED_HEADERS = ['@method', '@authority', '@target-uri', 'date']

export interface WarpOptions {
  router: string       // the Remote.It WARP router hostname
  keyId: string        // key id to use for authentication, defaults to process.env.R3_ACCESS_KEY_ID
  secret: string       // secret to use for authentication, defaults to process.env.R3_SECRET_ACCESS_KEY
  credentials: string  // path to the Remote.It credentials file
  profile: string      // profile name in the credentials file
  host: string         // host to bind to, defaults to localhost
  port?: number        // leave undefined to find an available port
  minPort: number      // minimum port to scan
  maxPort: number      // minimum port to scan
  timeout: number      // timeout, defaults to 5000 ms
  userAgent: string    // user agent to use, defaults to remoteit-warp/1.0
  pingInterval: number // ping interval, defaults to 60000 ms
}

const DEFAULT_OPTIONS: Partial<WarpOptions> = {
  router: 'connect.remote.it',
  keyId: process.env.R3_ACCESS_KEY_ID,
  secret: process.env.R3_SECRET_ACCESS_KEY,
  credentials: path.resolve(os.homedir(), '.remoteit/credentials'),
  profile: 'DEFAULT',
  host: '127.0.0.1',
  minPort: 30000,
  maxPort: 39999,
  timeout: 5000,
  userAgent: 'remoteit-warp/1.0',
  pingInterval: 60000
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
    const target = await this.openTarget()

    const onError = (error?: Error) => error && console.error(error)

    target.once('connect', () => {
      pump(client, target, onError)
      pump(target, client, onError)
    })
  }

  private async openTarget(): Promise<Duplex> {
    const options = this.signature ? await signMessage(
      {
        key: this.signature,
        name: 'remoteit',
        fields: SIGNED_HEADERS
      },
      {
        method: 'GET',
        url: this.url,
        headers: {
          'user-agent': this.options.userAgent,
          date: new Date().toUTCString()
        }
      }
    ) : {
      headers: {
        'user-agent': this.options.userAgent
      }
    }

    const ws = new WebSocket(this.url, {
      ...options,
      agent: new https.Agent({
        timeout: this.options.timeout,
        noDelay: true
      })
    })

    this.monitor(ws) // monitor WebSocket

    // @ts-ignore
    return websocketStream(ws, {binary: true}).on('error', error => console.error(error))
  }

  private parseURL(target: string): URL {
    if (!target) throw new Error(`Remote.It WARP target required`)

    const match = target.match(TARGET_REGEXP)

    if (!match) throw new Error(`Remote.It WARP target invalid: ${target}`)

    const {code, host} = match.groups || {}

    if (host) return new URL(`wss://${host}`)

    const subdomain = code.replace(/[^0-9a-z]+/ig, '').toLowerCase()

    return new URL(`wss://${subdomain}.${this.options.router}`)
  }

  private async getSignature(): Promise<SigningKey | null> {
    let {keyId, secret} = this.options

    if (!keyId || !secret) {
      let {credentials, profile} = this.options

      if (!fs.existsSync(credentials)) {
        console.error(`${credentials} not found, using unauthenticated access`)

        return null
      }

      let hash = null

      try {
        hash = ini.parse(fs.readFileSync(credentials, 'utf-8'))
      } catch (error: any) {
        throw new Error(`Remote.It credentials file error: ${error.message}`)
      }

      const section = hash[profile]

      if (!section) throw new Error(`Remote.It credential profile not found: ${profile}`);

      ({R3_ACCESS_KEY_ID: keyId, R3_SECRET_ACCESS_KEY: secret} = section)

      if (!keyId) throw new Error(`Remote.It credentials missing: R3_ACCESS_KEY_ID`)
      if (!secret) throw new Error(`Remote.It credentials missing: R3_SECRET_ACCESS_KEY`)
    }

    console.error(`using key id: ${keyId}`)

    return createSigner(Buffer.from(secret, 'base64'), SIGNATURE_ALGORITHM, keyId)
  }

  private async getNextAvailablePort(): Promise<number | null> {
    const {host, minPort, maxPort} = this.options

    for (let port: number = minPort; port <= maxPort; port++) {
      if (!await tcpPortUsed.check(port, host)) return port
    }

    return null
  }

  private monitor(ws: WebSocket) {
    let alive = true

    ws.on('pong', () => {alive = true})

    const interval = setInterval(() => {
      if (!alive) return ws.terminate()

      alive = false

      ws.ping()
    }, this.options.pingInterval)

    ws.once('close', () => clearInterval(interval))
  }
}
