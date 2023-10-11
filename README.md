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
const proxy = new WarpProxy({url: 'wss://xxxxxxxx.connect.remote.it'});

// Activate the proxy and get the localhost port
const port = await proxy.open();

// Use the localhost port in your application

// Close the proxy when done
await proxy.close();
```

## Advanced Usage :wrench:

If you need more control or want to integrate with specific services, **warp** provides advanced configurations and
options:

```typescript
import {WarpProxy} from '@remote.it/warp'

const proxy = new WarpProxy({
  url: 'wss://xxxxxxxx.connect.remote.it',  // persistent service websocket URL
  credentials: 'path/to/credentials',       // path to Remote.It credentials file, defaults to ~/.remoteit/credentials
  profile: 'MyProfile',                     // profile name to use, defaults to 'DEFAULT'
  host: '127.0.0.1',                        // host to bind to, defaults to '127.0.0.1'
  port: 2222,                               // proxy port, will default to the first available port in the range below
  minPort: 30000,                           // lowest port to use when searching for an available port, defaults to 30000
  maxPort: 39999,                           // highest port to use when searching for an available port, defaults to 39999
  timeout: 10000,                           // timeout to establish the websocket connection, defaults to 10000
  userAgent: 'my-application/1.0',          // custom user agent, defaults to 'remoteit-warp/1.0'
  pingInterval: 60000                       // websocket ping interval, defaults to 60000
})

// Rest of the usage remains the same
```

## Credential File Structure :key:

The credential file is designed to store access keys for the Remote.It WARP service. This structure allows you to define
multiple profiles, each with its own set of credentials. You can create and manage your keys in your [Remote.It account AccessKeys page](https://link.remote.it/credentials).

The file is formatted in the INI style, where each section corresponds to a unique profile.

### Basic Structure:

```credentials
[ProfileName]
R3_ACCESS_KEY_ID=YourAccessKeyID
R3_SECRET_ACCESS_KEY=YourSecretAccessKey
```

- **ProfileName**: Represents the name of the profile, allowing you to differentiate between various sets of
  credentials. By default, the profile is named `DEFAULT`.
- **R3_ACCESS_KEY_ID**: Your designated Access Key ID for authentication.
- **R3_SECRET_ACCESS_KEY**: Your Secret Access Key used for authentication.

### Sample:

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

**Note**:

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
