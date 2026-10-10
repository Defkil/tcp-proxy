import type { Server, Socket } from 'node:net'

declare namespace SimpleTcpProxy {
  interface Address {
    /** Host name or IP address. */
    host?: string
    /** TCP port. */
    port: number
  }

  interface Options {
    /** Where the proxy listens. Without `host` it listens on all interfaces; port `0` picks a free port. */
    proxy: Address
    /** Where every connection is forwarded to. Without `host` it connects to `localhost`. */
    target: Address
  }

  /** Called for every accepted connection with the client socket and the socket to the target. */
  type ConnectionListener = (client: Socket, target: Socket) => void

  /** Called with every error once the proxy is listening. The affected connection is closed either way. */
  type ErrorListener = (error: Error) => void
}

declare class SimpleTcpProxy {
  /** @throws {TypeError} when `proxy` or a valid `target.port` is missing */
  constructor (options: SimpleTcpProxy.Options)

  proxy: SimpleTcpProxy.Address
  target: SimpleTcpProxy.Address
  /** `'online'` while the proxy is listening. */
  readonly status: 'online' | 'offline'
  /** The proxy server; `undefined` before `start()` and after `close()`. */
  readonly server: Server | undefined
  /** The target socket of every open connection, keyed by a random connection id. */
  readonly client_con: Readonly<Record<string, Socket>>

  /**
   * Listens on `proxy` and forwards every connection to `target`.
   * Resolves when the proxy is listening and rejects when it cannot listen.
   */
  start (onConnection?: SimpleTcpProxy.ConnectionListener, onError?: SimpleTcpProxy.ErrorListener): Promise<void>

  /**
   * Stops listening and closes all open connections. Resolves when the proxy is closed; never rejects.
   */
  close (callback?: () => void): Promise<void>

  /**
   * Creates and starts a proxy. If it cannot listen, the error goes to `onError`.
   */
  static run (
    options: SimpleTcpProxy.Options,
    onConnection?: SimpleTcpProxy.ConnectionListener,
    onError?: SimpleTcpProxy.ErrorListener
  ): SimpleTcpProxy
}

export = SimpleTcpProxy
