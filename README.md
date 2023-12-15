# socket-link :electric_plug:

**socket-link** is a powerful SDK and CLI for integrating with the **Remote.It** **socket-link** infrastructure. Perfect
for setting up a secure one-time connection or developing a complex network application, **socket-link** simplifies
networking.

[![npm version](https://badge.fury.io/js/%40remote.it%2Fsocket-link.svg)](https://www.npmjs.com/package/@remote.it/socket-link)

## Features :sparkles:

- **Seamless Integration**: Securely connect to the **Remote.It** **socket-link** infrastructure.
- **Effortless Management**: Intuitive API for setting up and tearing down connections.
- **TypeScript-Powered**: Modern language for the best development experience.
- **Signature Authentication**: Secure authentication using HTTP signatures.
- **TLS Encryption**: Ensure data protection while in transit.

## Installation :package:

```shell
npm i @remote.it/socket-link
```
Use the command shown above for inclusion in your Node.js application, or add `-g` to install globally if you plan to use the command-line interface (CLI) on your device. 

## Basic Usage :computer:

Setting up a **socket-link** proxy is straightforward:

```typescript
import {SocketLink} from '@remote.it/socket-link'

const socketLink = new SocketLink()

// Specify the target service and other optional parameters
const proxy = socketLink.connect('MNETSJSW')

// Retrieve the proxy address
const address = proxy.address

// Use the address in your application

// Close the proxy when done
await proxy.close()
```

## Service Setup :dart:

Don't have a **Remote.It** account? [Sign up for free](https://app.**Remote.It**/#/sign-up). Then, follow these steps to
configure your target service:

1. Log in to the **Remote.It** portal or desktop.
2. Click the `+` button to add a new device.
3. Select your device type.
4. Copy the installation command.
5. Run the command on your device.
6. Once the device appears in the application, configure the port you wish to connect to by selecting a service type (
   SSH,
   HTTPS, Postgresql, etc.) or manually entering it.
7. For networked services, specify the network IP address and port to forward.

## Advanced Usage :wrench:

For more control or specific service integration, **socket-link** offers advanced configuration options:

```typescript
const socketLink = new SocketLink({
  config: 'path/to/config', // Path to Remote.It config files, defaults to ~/.remoteit
  profile: 'MyProfile'      // Credential profile name to use, defaults to 'DEFAULT'
})

const proxy = socketLink.connect(
  'MNETSJSW',           // Service Key, required
  {
    bind: '127.0.0.1',  // Address to bind to, defaults to '127.0.0.1'
    port: 2222          // Proxy port, defaults to available port
  }
)

// Rest of the usage remains the same
```

## Authentication :key:

Connections are authenticated using a combination of a _Service Key_ and _Credentials_. They can be combined in a
variety of ways to suit your needs, but one is required for a successful connection.

A **Service Key** is a unique service level identifier. It can be found in the **Remote.It** app on the target service
details page.

A **Credentials** file is designed to store account level access keys for an application. You can create and manage your
keys in your [Remote.It account AccessKeys page](https://link.remote.it/credentials).

### Service Key

Creating a basic connection only requires a `Service Key`

This key provides the authentication and identity needed to connect. Keep it protected and do not commit it to your
codebase. It can be revoked at any time and is unique to each service.

#### Sample

```
MNETSJSW
```

Generate a key in the **Remote.It** app on the target service details page.

### Credentials

Credentials can be provided in three ways:

1. **Environment Variables**: You can set your **Remote.It** credentials as environment variables: `R3_ACCESS_KEY_ID`
   and `R3_SECRET_ACCESS_KEY`.

2. **Configuration Options**: Alternatively, you can provide your credentials as configuration options: `keyId`
   and `secret`.

3. **Credentials File**: For enhanced security, it is recommended to use the credentials file.

If no credentials are specified, and the default **Remote.It** credentials file is not found, the connection will remain
unauthenticated.

The credential file is designed to store access keys for the **Remote.It** **socket-link** service. This structure
allows you
to define multiple profiles, each with its own set of credentials. You can create and manage your keys in
your [Remote.It account AccessKeys page](https://link.remote.it/credentials).

The file is formatted in the INI style, where each section corresponds to a unique profile.

#### Basic Structure

```credentials
[ProfileName]
R3_ACCESS_KEY_ID=YourAccessKeyID
R3_SECRET_ACCESS_KEY=YourSecretAccessKey
```

- **ProfileName**: Represents the name of the profile, allowing you to differentiate between various sets of
  credentials. By default, the profile named `DEFAULT` will be used or the top level credentials if no default profile
  is present.
- **R3_ACCESS_KEY_ID**: Your designated Access Key ID for authentication.
- **R3_SECRET_ACCESS_KEY**: Your Secret Access Key used for authentication.

#### Sample

```credentials
# default credentials
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

Dive deep into the features and configurations in
our [official documentation](https://github.com/remoteit/socket-link.js).

## Support and Contribution :raising_hand:

Run into problems? or have suggestions? Your feedback is invaluable. Open
an [issue](https://github.com/remoteit/socket-link.js/issues) or submit a pull request.

## License :page_facing_up:

Licensed under MIT. For details, see [LICENSE.md](LICENSE.md).
