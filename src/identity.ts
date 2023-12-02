import {instanceToPlain, plainToInstance, Transform, TransformationType, TransformFnParams} from 'class-transformer'
import crypto, {KeyObject} from 'crypto'
import fs from 'fs/promises'
import jwt from 'jsonwebtoken'
import os from 'os'
import path from 'path'
import {IDENTITY_FILE, USER_AGENT} from './constants'
import {SocketLink} from './socket-link'
import {getPrimaryNetwork} from './utils'

const KeyTransform = (params: TransformFnParams): any => {
  const {value} = params

  switch (params.type) {
    case TransformationType.PLAIN_TO_CLASS:
      return crypto.createPrivateKey({key: value as string, format: 'der', type: 'pkcs8', encoding: 'base64'})

    case TransformationType.CLASS_TO_PLAIN:
      return (value as KeyObject).export({format: 'der', type: 'pkcs8'}).toString('base64')
  }

  return undefined
}

export class Identity {
  readonly id!: string

  @Transform(KeyTransform)
  private readonly key!: KeyObject

  get token(): string {
    return jwt.sign({id: this.id}, this.key, {algorithm: 'ES256'})
  }

  static async initialize(client: SocketLink): Promise<Identity> {
    const file = client.resolve(IDENTITY_FILE)

    try {
      await fs.access(file, fs.constants.R_OK)

      console.error(`loading identity ${file}`)

      const buffer = await fs.readFile(file)

      return plainToInstance(this, JSON.parse(buffer.toString()))
    } catch (error) {
      console.error(`${file} not found, generating new identity...`)

      const identity = await this.register(client)

      return identity.save(file)
    }
  }

  static async register(client: SocketLink): Promise<Identity> {
    const {publicKey, privateKey} = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: {
        type: 'spki',
        format: 'der'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'der'
      }
    })

    const name = os.hostname().split('.')[0]
    const network = getPrimaryNetwork()
    const mac = network?.mac

    console.log(`registering ${name} with ${client.router}...`)

    const request = {
      method: 'POST',
      url: `https://api.${client.router}/register`,
      headers: {
        'user-agent': USER_AGENT,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
          name,
          mac,
          key: publicKey.toString('base64')
        }
      )
    }

    const response: any = await fetch(request.url, request).catch(() => null)

    if (!response.ok) throw new Error(response.statusText)

    const {id} = await response.json()

    console.error(`${id} registered`)

    return plainToInstance(this, {
      id,
      key: privateKey.toString('base64')
    })
  }

  async save(file: string): Promise<this> {
    console.error(`saving identity ${file}`)

    const dir = path.dirname(file)

    await fs.mkdir(dir, {recursive: true}) // create directory if needed

    const plain = instanceToPlain(this)

    await fs.writeFile(file, JSON.stringify(plain, null, 2))

    return this
  }
}
