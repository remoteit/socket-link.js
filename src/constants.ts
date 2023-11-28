import {homedir} from 'os'
import {resolve} from 'path'
// @ts-ignore
import {version} from '../package.json'

export const PROGRAM_VERSION: string = version
export const PROGRAM_NAME: string = 'socket-link'
export const PROGRAM_DESCRIPTION: string = 'Remote.It socket-link CLI'

export const USER_AGENT: string = 'remoteit-socket-link/1.0'

export const DEFAULT_ROUTER: string = 'connect.remote.it'
export const DEBUG_ROUTER: string = 'dev-connect.remote.it'

export const GRAPHQL_URL: string = 'https://api.remote.it/graphql/v1'

export const DEFAULT_CONFIG: string = resolve(homedir(), '.remoteit')
export const DEFAULT_PROFILE: string = 'DEFAULT'

export const CREDENTIALS_FILE: string = 'credentials'

export const SIGNATURE_ALGORITHM: string = 'hmac-sha256'
export const SIGNED_HEADERS: string[] = ['@method', '@authority', '@target-uri', 'date']

export const LOCALHOST: string = '127.0.0.1'

export const MIN_SCAN_PORT: number = 30000
export const MAX_SCAN_PORT: number = 39999

export const CONNECT_TIMEOUT: number = 20000 // 20 seconds

export const PING_INTERVAL: number = 60000 // 1 minute
