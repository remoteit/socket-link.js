# warp :rocket:

**warp** is a powerful SDK and CLI for integrating with the Remote.It WARP service. Whether you're looking to quickly
establish a secure connection or building a complex network application, **warp** has got you covered.

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

To quickly set up a WARP proxy:

```typescript
import {WarpProxy} from '@remote.it/warp';

// Initialize a new WARP proxy to the target service
const proxy = new WarpProxy({url: 'wss://xxxxxxxx.connect.remote.it'});

// Open and retrieve the localhost port
const port = await proxy.open();

// You can now use the localhost port in your application

// Don't forget to gracefully close when done!
await proxy.close();
```

## API Documentation :book:

For a more comprehensive guide and API
documentation, [visit our official documentation](https://github.com/remoteit/warp-js).

## Support and Contribution :raising_hand:

Encountered issues or have suggestions? Feel free to open an [issue](https://github.com/remoteit/warp-js/issues) or
submit a pull request.

## License :page_facing_up:

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
