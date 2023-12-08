import {createSocket} from 'dgram'
import {signMessage} from 'http-message-signatures/lib/httpbis'
import {SigningKey} from 'http-message-signatures/lib/types'
import {createServer} from 'net'
import os from 'os'
import {SIGNED_HEADERS, USER_AGENT} from './constants'

export async function getAvailableTCPPort(min: number, max: number, address: string): Promise<number | null> {
  for (let port = min; port <= max; port++) {
    if (await isTCPPortAvailable(port, address)) return port
  }

  return null
}

export async function getAvailableUDPPort(min: number, max: number, address: string): Promise<number | null> {
  for (let port = min; port <= max; port++) {
    if (await isUDPPortAvailable(port, address)) return port
  }

  return null
}

export async function isTCPPortAvailable(port: number, address: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()

    server.on('listening', () => server.close())
          .on('close', () => resolve(true))
          .on('error', () => resolve(false))
          .listen(port, address)
  })
}

export async function isUDPPortAvailable(port: number, address: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createSocket('udp4')

    socket.on('listening', () => socket.close())
          .on('close', () => resolve(true))
          .on('error', () => resolve(false))
          .bind(port, address)
  })
}

export function getPrimaryNetwork(): os.NetworkInterfaceInfo | null {
  const interfaces = os.networkInterfaces()

  for (const [name, list] of Object.entries(interfaces)) {
    const info = list?.find((info) => info.family === 'IPv4' && !info.internal)

    if (info) return info
  }

  return null
}

export async function signRequest(request: any, key?: SigningKey): Promise<any> {
  const headers = request.headers ||= {}

  if (headers.authorization || !key) return request // we have an authorization header or no key, skip signing

  headers.date ||= new Date().toUTCString()
  headers['user-agent'] ||= USER_AGENT
  headers['content-type'] ||= 'application/json'

  return signMessage({key, name: 'remoteit', fields: SIGNED_HEADERS}, request)
}
