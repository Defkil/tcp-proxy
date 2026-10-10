# simple-tcp-proxy

[![npm](https://img.shields.io/npm/v/simple-tcp-proxy)](https://www.npmjs.com/package/simple-tcp-proxy)
[![CI](https://github.com/Defkil/tcp-proxy/actions/workflows/publish.yml/badge.svg?branch=master)](https://github.com/Defkil/tcp-proxy/actions/workflows/publish.yml)

A small TCP proxy for Node.js. It listens on an address of your choice and forwards every
connection to a target host. Data flows in both directions with backpressure, a half-close is
passed on, a failing side resets the other one instead of crashing your process, and `close()`
shuts everything down. No dependencies, TypeScript types included.

## Install

```sh
npm install simple-tcp-proxy
```

Requires Node.js 20 or newer. The package is CommonJS and works with `require` and `import`.

## Quick start

```js
const SimpleTcpProxy = require('simple-tcp-proxy') // or: import SimpleTcpProxy from 'simple-tcp-proxy'

const proxy = new SimpleTcpProxy({
  proxy: { host: '127.0.0.1', port: 8080 }, // where the proxy listens
  target: { host: 'example.com', port: 80 } // where every connection goes
})

proxy.start().then(() => console.log('Forwarding 127.0.0.1:8080 to example.com:80'))
```

To watch connections and their errors, pass listeners to `start()`; the proxy forwards the data
either way:

```js
proxy.start((client, target) => {
  console.log('Connection from', client.remoteAddress)
  client.on('data', (chunk) => console.log(`client -> target: ${chunk.length} bytes`))
  target.on('data', (chunk) => console.log(`target -> client: ${chunk.length} bytes`))
}, (error) => {
  console.error('Connection error:', error.message)
})
```

Or create and start a proxy in one call:

```js
const proxy = SimpleTcpProxy.run(
  { proxy: { port: 8080 }, target: { host: 'example.com', port: 80 } },
  undefined,
  (error) => console.error(error)
)
```

## API

### `new SimpleTcpProxy(options)`

| Option           | Type     | Description                                                                 |
| ---------------- | -------- | --------------------------------------------------------------------------- |
| `proxy.host`     | `string` | Address to listen on. Without it, the proxy listens on all interfaces.      |
| `proxy.port`     | `number` | Port to listen on. `0` picks a free port, see `server.address()`.          |
| `target.host`    | `string` | Host every connection is forwarded to. Defaults to `localhost`.             |
| `target.port`    | `number` | Port every connection is forwarded to.                                      |

Throws a `TypeError` when `proxy` is missing or `target.port` is not a valid port.

### `proxy.start([onConnection], [onError])`

Starts listening and returns a `Promise<void>` that resolves once the proxy is listening. It
rejects when the proxy cannot listen, for example with `EADDRINUSE` when the port is taken, and
when the proxy is already started.

- `onConnection(client, target)` is called for every accepted connection with two
  [`net.Socket`](https://nodejs.org/api/net.html#class-netsocket)s: `client` is the incoming
  connection, `target` the connection the proxy opens to the target, which may still be connecting.
- `onError(error)` is called with every error once the proxy is listening, see [Errors](#errors).

### `proxy.close([callback])`

Stops listening and closes all open connections. Returns a `Promise<void>` that resolves, and
calls `callback`, once the proxy is closed. It never rejects and is safe to call before `start()`,
while starting and more than once. A closed proxy can be started again.

### `SimpleTcpProxy.run(options, [onConnection], [onError])`

Creates a proxy, starts it and returns it right away. If it cannot listen, the error goes to
`onError`; without `onError` it is an unhandled promise rejection. Use `start()` to wait for the
proxy to listen.

### Properties

| Property     | Type                         | Description                                                    |
| ------------ | ---------------------------- | -------------------------------------------------------------- |
| `status`     | `'online' \| 'offline'`      | `'online'` while the proxy is listening.                       |
| `server`     | `net.Server \| undefined`    | The proxy server, `undefined` before `start()` and after `close()`. |
| `client_con` | `Record<string, net.Socket>` | The target socket of every open connection, by connection id.  |
| `proxy`      | `{ host?, port }`            | The `proxy` option.                                            |
| `target`     | `{ host?, port }`            | The `target` option.                                           |

## How connections are handled

- Data is piped in both directions with backpressure: a slow reader slows the sender down instead
  of filling the proxy's memory.
- When one side ends its output (a TCP half-close), the proxy passes the end on and keeps the other
  direction open, so protocols that half-close after a request still get their answer.
- When one side closes the connection, the proxy closes the other side as well.
- When one side fails, for example because the target refuses the connection or a peer resets it,
  the proxy resets the other side.
- Both sockets have `TCP_NODELAY` set, so the proxy adds no Nagle delay.

## Errors

Connection errors never crash the process. Every error on either socket of a connection and every
server error after `start()` resolved goes to `onError`; without `onError` they are ignored. The
affected connection is closed or reset either way. Typical codes are `ECONNREFUSED` (the target is
down), `ECONNRESET` (a peer reset the connection) and `EMFILE` (out of file descriptors).

Errors while starting, such as `EADDRINUSE` or `EACCES`, reject `start()`, or go to `onError` when
the proxy was created with `run()`.

## TypeScript

Types are included:

```ts
import SimpleTcpProxy from 'simple-tcp-proxy' // CommonJS: import SimpleTcpProxy = require('simple-tcp-proxy')
import type { Options } from 'simple-tcp-proxy'

const options: Options = { proxy: { port: 8080 }, target: { host: 'example.com', port: 80 } }
const proxy = new SimpleTcpProxy(options)
```

The namespace also exports `Address`, `ConnectionListener` and `ErrorListener`.

## Supported Node.js versions

Node.js 20 or newer. CI tests every push to `master` on Node.js 20, 22, 24 and 26.

## Migrating from 2.x

Version 3 keeps the 2.x API and fixes how connections are handled. Check these changes:

- Node.js 20 or newer is required, and the package entry is `index.js`: require
  `simple-tcp-proxy` itself, not `simple-tcp-proxy/dist/SimpleTcpProxy.js`.
- `status` is `'online'` while the proxy listens. In 2.x it turned `'online'` on the first
  connection.
- `start()` and `close()` return promises; their callbacks work as before. A port that is taken
  rejects `start()`, or goes to `onError` with `run()`. In 2.x it crashed the process.
- A connection closes or resets together with its other side. In 2.x the other side stayed open, so
  every closed client leaked its target connection.
- `close()` closes client connections as well and calls back once everything is closed. In 2.x its
  callback waited for every connected client to leave.
- The constructor throws on a missing `proxy` or an invalid `target.port` instead of failing on the
  first connection.

Coming from 1.x: the package exports the class, so call `SimpleTcpProxy.run(options)` instead of
the module itself.

## Development

```sh
npm install
npm test
npm run lint
```

A release is a version bump in `package.json` pushed to `master`: once lint and tests pass, CI
publishes the version to npm with trusted publishing and provenance.

## License

[ISC](LICENSE). Please follow the [code of conduct](CODE_OF_CONDUCT.md).
