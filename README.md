# warp-js :rocket:

**warp-js** is a powerful SDK and CLI for integrating with the Remote.It WARP service. Whether you're looking to quickly
establish a secure connection or building a complex network application, **warp-js** has got you covered.

[![npm version](https://badge.fury.io/js/%40remote.it%2Fwarp.svg)](https://www.npmjs.com/package/@remote.it/warp)

## Features :sparkles:

- Seamless integration with Remote.It WARP infrastructure.
- Simplified connection setup and teardown.
- Modern, TypeScript-based API for enhanced development experience.

## Installation :package:

Install the module via npm:

```shell
npm i @remote.it/warp
```

## Basic Usage :computer:

To quickly set up a WARP session:

```typescript
import {WarpSession} from '@remote.it/warp';

// Initialize a new WARP session
const session = new WarpSession({ url: 'wss://xxxxxxxx.connect.remote.it' });

// Connect and retrieve the localhost port
const port = await session.connect();

// You can now use the localhost port in your application

// Don't forget to gracefully disconnect when done!
await session.disconnect();
```

## API Documentation :book:

For a more comprehensive guide and API documentation, [visit our official documentation](https://github.com/remoteit/warp-js).

## Support and Contribution :raising_hand:

Encountered issues or have suggestions? Feel free to open an [issue](https://github.com/remoteit/warp-js/issues) or
submit a pull request.

## License :page_facing_up:

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
