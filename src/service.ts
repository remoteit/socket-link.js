import {WarpClient} from './client'
import {LOCALHOST} from './constants'

export interface ServiceOptions {
  host: string  // service address, defaults to localhost
  port: number  // port number
  udp?: boolean // UDP service
}

const DEFAULT_OPTIONS: Partial<ServiceOptions> = {
  host: LOCALHOST
}

export class WarpService {
  private readonly client: WarpClient
  private readonly options: ServiceOptions

  constructor(client: WarpClient, options: Partial<ServiceOptions> = {}) {
    this.client = client
    this.options = {...DEFAULT_OPTIONS, ...options} as ServiceOptions
  }

  async register(): Promise<this> {
    return this
  }
}
