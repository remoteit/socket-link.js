# warp :rocket:

**warp** is a powerful SDK and CLI for integrating with the Remote.It WARP infrastructure. Whether you're setting up a
one-time secure connection or architecting a complex network application, **warp** streamlines the process.

[![npm version](https://badge.fury.io/js/%40remote.it%2Fwarp.svg)](https://www.npmjs.com/package/@remote.it/warp)

## Features :sparkles:

- **Seamless Integration**: Securely connect with the Remote.It WARP infrastructure.
- **Effortless Management**: Intuitive methods for connection setup and teardown.
- **TypeScript-Powered**: A modern API for a clear development experience.
- **Signature Authentication**: Authenticate securely with HTTP message signatures.
- **TLS Encryption**: Protect your data in transit.

## Installation :package:

```shell
npm i @remote.it/warp
```

## Basic Usage :computer:

Setting up a WARP proxy is straightforward:

```typescript
import {WarpProxy} from '@remote.it/warp';

// Specify the target service and other optional parameters
const proxy = new WarpProxy('MNETSJSW');

// Activate the proxy and get the localhost port
const port = await proxy.open();

// Use the localhost port in your application

// Close the proxy when done
await proxy.close();
```

## Service Setup :dart:

If you don't have a Remote.It account you can [sign up for free here](https://app.remote.it/#/sign-up). Then continue to setup the target service:

1. Log into Remote.It
2. Add a new device with the "+" button
3. Select your device type
4. Copy the install command
5. Run it on your device or another device on it's local network
6. When the device appears in the app you can configure the port to want to connect to by service type (SSH, HTTPS, Postgresql ... etc) or manually
7. Or for a networked service you can set it up to use the network IP address and port to forward

## Advanced Usage :wrench:

If you need more control or want to integrate with specific services, **warp** provides advanced configurations and options:

```typescript
import {WarpProxy} from '@remote.it/warp'

const proxy = new WarpProxy(
  'MNETSJSW',                                           // Service Key (Target ID)
  {
    router: 'connect.remote.it',                        // WARP router, defaults to 'connect.remote.it'
    keyId: 'J6RBX6GAXLSAIQX6GH3I',                      // Key id to use for authentication, defaults to process.env.R3_ACCESS_KEY_ID
    secret: '2yw6NJA7q6jXdJvDbKBO4j9wi08o/ckR1X8CItUG', // Secret to use for authentication, defaults to process.env.R3_SECRET_ACCESS_KEY
    credentials: 'path/to/credentials',                 // Path to Remote.It credentials file, defaults to ~/.remoteit/credentials
    profile: 'MyProfile',                               // Credential profile name to use, defaults to 'DEFAULT'
    host: '127.0.0.1',                                  // Host to bind to, defaults to '127.0.0.1'
    port: 2222,                                         // Proxy port, defaults to first available port in the range below
    minPort: 30000,                                     // Lowest port for available port search, defaults to 30000
    maxPort: 39999,                                     // Highest port for available port search, defaults to 39999
    timeout: 5000,                                      // Timeout for WebSocket connection, defaults to 5000 ms
    pingInterval: 60000                                 // WebSocket ping interval, defaults to 60000 ms
  }
)

// Rest of the usage remains the same
```

## Authentication :key:

Connections are authenticated using a combination of a _Service Key_ and _Credentials_. They can be combined in a variety of ways to suit your needs, but one is required for a successful connection.

A **Service Key** is a unique service level identifier. It can be found in the Remote.It app on the target service details page.

A **Credentials** file is designed to store account level access keys for an application. You can create and manage your keys in your [Remote.It account AccessKeys page](https://link.remote.it/credentials).

### Service Key

Creating a basic connection only requires a `Service Key`

This key provides the authentication and identity needed to connect. Keep it protected and do not commit it to your codebase. It can be revoked at any time and is unique to each service.

#### Sample

```
MNETSJSW
```

Generate a key in the Remote.It app on the target service details page.

### Credentials

Credentials can be provided in three ways:

1. **Environment Variables**: You can set your Remote.It credentials as environment variables (`R3_ACCESS_KEY_ID`
   and `R3_SECRET_ACCESS_KEY`).

2. **Constructor Options**: Alternatively, you can provide your credentials directly as options (`keyId` and `secret`)
   in the constructor.

3. **Credentials File**: For enhanced security, it is recommended to use a credentials file.

If no credentials are specified, and the default Remote.It credentials file is not found, the connection will remain
unauthenticated.

The credential file is designed to store access keys for the Remote.It WARP service. This structure allows you to define
multiple profiles, each with its own set of credentials. You can create and manage your keys in
your [Remote.It account AccessKeys page](https://link.remote.it/credentials).

The file is formatted in the INI style, where each section corresponds to a unique profile.

#### Basic Structure

```credentials
[ProfileName]
R3_ACCESS_KEY_ID=YourAccessKeyID
R3_SECRET_ACCESS_KEY=YourSecretAccessKey
```

- **ProfileName**: Represents the name of the profile, allowing you to differentiate between various sets of
  credentials. By default, the profile is named `DEFAULT`.
- **R3_ACCESS_KEY_ID**: Your designated Access Key ID for authentication.
- **R3_SECRET_ACCESS_KEY**: Your Secret Access Key used for authentication.

#### Sample

```credentials
[DEFAULT]
# Remote.It credentials
R3_ACCESS_KEY_ID=CKP6FWW5POAKHTZAAKPI
R3_SECRET_ACCESS_KEY=rSfaY4sj07jZV8+GYEjx/PSiln9x9t/8zZbdpgMS

[MyProfile]
# Custom credentials
R3_ACCESS_KEY_ID=J6RBX6GAXLSAIQX6GH3I
R3_SECRET_ACCESS_KEY=2yw6NJA7q6jXdJvDbKBO4j9wi08o/ckR1X8CItUG
```

**Note**

- Keep your credentials confidential to avoid unauthorized access.
- Always backup your credentials securely.
- Refrain from adding credentials to version control systems, such as Git.
- The credentials on this page are for demonstration purposes only.

## API Documentation :book:

Dive deep into the features and configurations in our [official documentation](https://github.com/remoteit/warp-js).

## Support and Contribution :raising_hand:

Run into issues? Have ideas? We value your feedback! Open an [issue](https://github.com/remoteit/warp-js/issues) or
shoot a pull request.

## License :page_facing_up:

MIT Licensed. Detailed info in [LICENSE.md](LICENSE.md).
