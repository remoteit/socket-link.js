import {existsSync, readFileSync} from 'fs'
import {createSigner} from 'http-message-signatures/lib/algorithm'
import {signMessage} from 'http-message-signatures/lib/httpbis'
import {SigningKey} from 'http-message-signatures/lib/types'
import {parse} from 'ini'
import {resolve} from 'path'
import {
  CREDENTIALS_FILE,
  DEBUG_ROUTER,
  DEFAULT_CONFIG,
  DEFAULT_PROFILE,
  DEFAULT_ROUTER,
  GRAPHQL_URL,
  SIGNATURE_ALGORITHM,
  SIGNED_HEADERS,
  USER_AGENT
} from './constants'
import {ProxyOptions, WarpProxy} from './proxy'
import {ServiceOptions, WarpService} from './service'

export interface ClientOptions {
  router: string  // Remote.It WARP router hostname
  keyId: string   // authentication key ID, defaults to process.env.R3_ACCESS_KEY_ID
  secret: string  // authentication secret, defaults to process.env.R3_SECRET_ACCESS_KEY
  config: string  // path to the Remote.It configuration files
  profile: string // credential profile name
  debug: boolean  // enable debug output
}

const DEFAULT_OPTIONS: Partial<ClientOptions> = {
  keyId: process.env.R3_ACCESS_KEY_ID,
  secret: process.env.R3_SECRET_ACCESS_KEY,
  config: DEFAULT_CONFIG,
  profile: DEFAULT_PROFILE
}

export class WarpClient {
  private readonly options: ClientOptions

  constructor(options: Partial<ClientOptions> = {}) {
    options.router ||= options.debug ? DEBUG_ROUTER : DEFAULT_ROUTER

    this.options = {...DEFAULT_OPTIONS, ...options} as ClientOptions
  }

  get debug(): boolean {
    return this.options.debug
  }

  get router(): string {
    return this.options.router
  }

  async api(query: string, variables?: any): Promise<any> {
    const request = await this.sign({
      method: 'POST',
      url: GRAPHQL_URL,
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({query, variables})
    })

    const response: any = await fetch(request.url, request).catch(() => null)

    if (!response.ok) throw new Error(response.statusText)

    const {data, errors} = await response.json()

    if (errors) throw new Error(errors.map((error: any) => error.message).join(', '))

    return data
  }

  async connect(target: string, options: Partial<ProxyOptions> = {}): Promise<WarpProxy> {
    const proxy = new WarpProxy(this, target, options)

    return proxy.open()
  }

  async sign(request: any): Promise<any> {
    if (request.headers?.authorization) return request // we have an authorization header, skip signing

    const key = await this.getSignature()

    if (!key) return request // no key, skip signing

    // add required signing headers

    Object.assign(request.headers ||= {}, {
      date: new Date().toUTCString(),
      'user-agent': USER_AGENT
    })

    return signMessage({key, name: 'remoteit', fields: SIGNED_HEADERS}, request)
  }

  private async getSignature(): Promise<SigningKey | undefined> {
    let {keyId, secret} = this.options

    if (!keyId || !secret) {
      const {config, profile} = this.options

      const credentials = resolve(config, CREDENTIALS_FILE)

      if (!existsSync(credentials)) {
        console.error(`${credentials} not found, unauthenticated access`)

        return undefined
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

  async register(options: Partial<ServiceOptions> = {}): Promise<WarpService> {
    const service = new WarpService(this, options)

    return service.register()
  }
}
