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
  credentials: string  // path to Remote.It credentials file
  profile: string      // profile name in the credentials file
  host: string         // host to bind to, defaults to localhost
  port?: number        // leave undefined to find an available port
  minPort: number      // minimum port to scan
  maxPort: number      // minimum port to scan
  timeout: number      // timeout, defaults to 10000 ms
  userAgent: string    // user agent to use, defaults to remoteit-warp/1.0
  pingInterval: number // ping interval, defaults to 60000 ms
}

const DEFAULT_OPTIONS: Partial<WarpOptions> = {
  router: 'connect.remote.it',
  credentials: path.resolve(os.homedir(), '.remoteit/credentials'),
  profile: 'DEFAULT',
  host: '127.0.0.1',
  minPort: 30000,
  maxPort: 39999,
  timeout: 10000,
  userAgent: 'remoteit-warp/1.0',
  pingInterval: 60000
}

export class WarpProxy {
  private readonly url: URL
  private readonly options: WarpOptions
  private server!: Server

  constructor(target: string, options: Partial<WarpOptions> = {}) {
    this.options = {...DEFAULT_OPTIONS, ...options} as WarpOptions
    this.url = this.parseTarget(target)
  }

  async open(): Promise<number> {
    this.server = createServer({noDelay: true})

    const port = this.options.port || await this.getNextAvailablePort()

    if (!port) throw new Error(`no available port found`)

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
    const options = await signMessage(
      {
        key: await this.getKey(),
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
    )

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

  private parseTarget(target: string): URL {
    if (!target) throw new Error(`Remote.It WARP URL or target ID required`)

    const match = target.match(TARGET_REGEXP)

    if (!match) throw new Error(`Remote.It WARP URL or target ID invalid: ${target}`)

    const {code, host} = match.groups || {}

    if (host) return new URL(`wss://${host}`)

    const subdomain = code.replace(/[^0-9a-z]+/ig, '').toLowerCase()

    return new URL(`wss://${subdomain}.${this.options.router}`)
  }

  private async getKey(): Promise<SigningKey> {
    let {R3_ACCESS_KEY_ID, R3_SECRET_ACCESS_KEY} = process.env

    if (!R3_ACCESS_KEY_ID || !R3_SECRET_ACCESS_KEY) {
      const file = this.options.credentials

      if (!fs.existsSync(file)) throw new Error(`Remote.It credentials file not found: ${file}`)

      let credentials = null

      try {
        credentials = ini.parse(fs.readFileSync(file, 'utf-8'))
      } catch (error: any) {
        throw new Error(`Remote.It credentials file error: ${error.message}`)
      }

      const profile = this.options.profile

      const section = credentials[profile]

      if (!section) throw new Error(`Remote.It profile not found: ${profile}`);

      ({R3_ACCESS_KEY_ID, R3_SECRET_ACCESS_KEY} = section)
    }

    if (!R3_ACCESS_KEY_ID) throw new Error(`Remote.It credentials missing: R3_ACCESS_KEY_ID`)
    if (!R3_SECRET_ACCESS_KEY) throw new Error(`Remote.It credentials missing: R3_SECRET_ACCESS_KEY`)

    return createSigner(Buffer.from(R3_SECRET_ACCESS_KEY, 'base64'), SIGNATURE_ALGORITHM, R3_ACCESS_KEY_ID)
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
