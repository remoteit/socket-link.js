import {createSocket} from 'dgram'
import {createServer} from 'net'

export async function getAvailableTCPPort(min: number, max: number): Promise<number | null> {
  for (let port = min; port <= max; port++) {
    if (await isTCPPortAvailable(port)) return port
  }

  return null
}

export async function getAvailableUDPPort(min: number, max: number): Promise<number | null> {
  for (let port = min; port <= max; port++) {
    if (await isUDPPortAvailable(port)) return port
  }

  return null
}

export async function isTCPPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()

    server.on('listening', () => server.close())
          .on('close', () => resolve(true))
          .on('error', () => resolve(false))
          .listen(port)
  })
}

export async function isUDPPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createSocket('udp4')

    socket.on('listening', () => socket.close())
          .on('close', () => resolve(true))
          .on('error', () => resolve(false))
          .bind(port)
  })
}
