import * as console from 'console'
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
import * as tcpPortUsed from 'tcp-port-used'
import websocketStream from 'websocket-stream'
import WebSocket from 'ws'

const SIGNATURE_ALGORITHM = 'hmac-sha256'
const SIGNED_HEADERS = ['@method', '@authority', '@target-uri', 'date']

export interface WarpOptions {
  url: string
  credentials: string // path to remote.it credentials file
  profile: string // profile name in the credentials file
  host: string // host to bind to, defaults to localhost
  port?: number // leave undefined to find an available port
  minPort: number // minimum port to use
  maxPort: number // minimum port to use
  timeout: number // timeout, defaults to 30000 ms
  userAgent: string // user agent to use, defaults to remoteit-warp/1.0
  pingInterval: number // ping interval, defaults to 60000 ms
}

const DEFAULT_OPTIONS: Partial<WarpOptions> = {
  credentials: path.resolve(os.homedir(), '.remoteit/credentials'),
  profile: 'DEFAULT',
  host: '127.0.0.1',
  minPort: 30000,
  maxPort: 39999,
  timeout: 30000,
  userAgent: 'remoteit-warp/1.0',
  pingInterval: 60000
}

export class WarpSession {
  private readonly options: WarpOptions
  private lastPort!: number
  private server!: Server

  constructor(options: Partial<WarpOptions>) {
    this.options = {...DEFAULT_OPTIONS, ...options} as WarpOptions
  }

  async connect(): Promise<number> {
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

  async disconnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server?.close(error => error ? reject(error) : resolve())
    })
  }

  private async tunnel(client: Socket) {
    const url = new URL(this.options.url)

    url.protocol = 'wss'

    const options = await signMessage(
      {
        key: await this.getKey(),
        name: 'remoteit',
        fields: SIGNED_HEADERS
      },
      {
        method: 'GET',
        url,
        headers: {
          'user-agent': this.options.userAgent,
          date: new Date().toUTCString()
        }
      }
    )

    const ws = new WebSocket(url, {
      ...options,
      agent: new https.Agent({
        timeout: this.options.timeout,
        noDelay: true
      })
    })

    this.monitor(ws) // monitor WebSocket

    const onError = (error: Error | undefined): void => {if (error) console.error(error)}

    // @ts-ignore
    const target = websocketStream(ws, {binary: true}).on('error', onError)

    target.once('connect', () => {
      pump(client, target, onError)
      pump(target, client, onError)
    })
  }

  private async getKey(): Promise<SigningKey> {
    let {R3_ACCESS_KEY_ID, R3_SECRET_ACCESS_KEY} = process.env

    if (!R3_ACCESS_KEY_ID || !R3_SECRET_ACCESS_KEY) {
      const file = this.options.credentials

      if (!fs.existsSync(file)) throw new Error(`remote.it credentials file not found: ${file}`)

      let credentials = null

      try {
        credentials = ini.parse(fs.readFileSync(file, 'utf-8'))
      } catch (error: any) {
        throw new Error(`remote.it credentials file error: ${error.message}`)
      }

      const profile = this.options.profile

      const section = credentials[profile]

      if (!section) throw new Error(`remote.it profile not found: ${profile}`);

      ({R3_ACCESS_KEY_ID, R3_SECRET_ACCESS_KEY} = section)
    }

    if (!R3_ACCESS_KEY_ID) throw new Error(`remote.it credentials missing: R3_ACCESS_KEY_ID`)
    if (!R3_SECRET_ACCESS_KEY) throw new Error(`remote.it credentials missing: R3_SECRET_ACCESS_KEY`)

    return createSigner(Buffer.from(R3_SECRET_ACCESS_KEY, 'base64'), SIGNATURE_ALGORITHM, R3_ACCESS_KEY_ID)
  }

  async getNextAvailablePort(): Promise<number | null> {
    const {host, minPort, maxPort} = this.options

    this.lastPort ||= maxPort

    for (let port: number = this.lastPort + 1; port <= maxPort; port++) {
      if (!await tcpPortUsed.check(port, host)) return this.lastPort = port
    }

    for (let port: number = minPort; port <= this.lastPort; port++) {
      if (!await tcpPortUsed.check(port, host)) return this.lastPort = port
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
