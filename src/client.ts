import {existsSync, readFileSync} from 'fs'
import {createSigner} from 'http-message-signatures/lib/algorithm'
import {SigningKey} from 'http-message-signatures/lib/types'
import {parse} from 'ini'
import {DEBUG_ROUTER, DEFAULT_CREDENTIALS, DEFAULT_PROFILE, DEFAULT_ROUTER, SIGNATURE_ALGORITHM} from './constants'
import {ProxyOptions, WarpProxy} from './proxy'

export interface ClientOptions {
  router: string      // Remote.It WARP router hostname
  keyId: string       // authentication key ID, defaults to process.env.R3_ACCESS_KEY_ID
  secret: string      // authentication secret, defaults to process.env.R3_SECRET_ACCESS_KEY
  credentials: string // path to the Remote.It credentials file
  profile: string     // credential profile name in the credentials file
  debug: boolean      // enable debug output
}

const DEFAULT_OPTIONS: Partial<ClientOptions> = {
  keyId: process.env.R3_ACCESS_KEY_ID,
  secret: process.env.R3_SECRET_ACCESS_KEY,
  credentials: DEFAULT_CREDENTIALS,
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

  async connect(target: string, options: Partial<ProxyOptions> = {}): Promise<WarpProxy> {
    const proxy = new WarpProxy(this, target, options)

    return proxy.open()
  }

  async getSignature(): Promise<SigningKey | undefined> {
    let {keyId, secret} = this.options

    if (!keyId || !secret) {
      let {credentials, profile} = this.options

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
}
