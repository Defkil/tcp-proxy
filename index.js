'use strict'

const net = require('node:net')
const { once } = require('node:events')
const { randomUUID } = require('node:crypto')

/** Forwards every TCP connection made to `proxy` to `target`. */
class SimpleTcpProxy {
  #listening // the latest start()
  #closed = Promise.resolve() // the latest close()
  #clients = new Set() // accepted sockets, so close() can end connections whose target is already gone

  /**
   * @param {{ proxy: { host?: string, port: number }, target: { host?: string, port: number } }} options
   */
  constructor (options) {
    const { proxy, target } = options
    // net.connect() would reject a bad target port only on the first connection, inside an event handler.
    const port = Number(target?.port)
    if (!proxy || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw new TypeError('options.proxy and options.target with a valid port are required')
    }
    this.proxy = proxy
    this.target = target
    /** @type {'online' | 'offline'} */
    this.status = 'offline'
    /** @type {net.Server | undefined} */
    this.server = undefined
    /** @type {Record<string, net.Socket>} the target socket of every open connection, by connection id */
    this.client_con = {}
  }

  /**
   * Listens on `proxy` and forwards every connection to `target`.
   *
   * @param {(client: net.Socket, target: net.Socket) => void} [onConnection]
   * @param {(error: Error) => void} [onError] gets every error once listening; without it they are ignored
   * @returns {Promise<void>} resolves when listening, rejects when the proxy cannot listen
   */
  start (onConnection, onError) {
    if (this.server) return Promise.reject(new Error('The proxy is already started'))
    // noDelay: the proxy must not add Nagle delays on top of what the peers send.
    const server = net.createServer({ allowHalfOpen: true, noDelay: true }, (client) => {
      const target = net.connect({ host: this.target.host, port: this.target.port, allowHalfOpen: true, noDelay: true })
      const id = randomUUID()
      this.#clients.add(client)
      this.client_con[id] = target
      client.once('close', () => this.#clients.delete(client))
      target.once('close', () => { delete this.client_con[id] })
      forward(client, target, onError)
      forward(target, client, onError)
      onConnection?.(client, target)
    })
    this.server = server
    this.#listening = this.#listen(server, onError)
    return this.#listening
  }

  async #listen (server, onError) {
    try {
      server.listen(this.proxy.port, this.proxy.host)
      await once(server, 'listening')
    } catch (err) {
      if (this.server === server) this.server = undefined
      throw err
    }
    // Once listening, a server only emits accept errors (such as EMFILE) and keeps running.
    server.on('error', (err) => onError?.(err))
    if (this.server === server) this.status = 'online'
  }

  /**
   * Stops listening and closes all open connections. Safe to call at any time and more than once.
   *
   * @param {() => void} [callback]
   * @returns {Promise<void>} resolves when the proxy is closed; never rejects
   */
  close (callback) {
    const server = this.server
    if (server) {
      // A start() still in progress settles first; closing under it would leave it waiting forever.
      const starting = this.status === 'online' ? undefined : this.#listening
      this.server = undefined
      this.status = 'offline'
      for (const client of this.#clients) client.destroy()
      for (const [id, target] of Object.entries(this.client_con)) {
        target.destroy()
        delete this.client_con[id]
      }
      this.#closed = this.#close(server, starting)
    }
    if (callback) this.#closed.then(() => callback())
    return this.#closed
  }

  async #close (server, starting) {
    if (starting) await starting.catch(() => {})
    if (server.listening) await new Promise((resolve) => server.close(() => resolve()))
  }

  /**
   * Creates and starts a proxy. If it cannot listen, the error goes to `onError`.
   *
   * @returns {SimpleTcpProxy}
   */
  static run (options, onConnection, onError) {
    const proxy = new (this ?? SimpleTcpProxy)(options) // `this` is unset when run() is used on its own
    const listening = proxy.start(onConnection, onError)
    if (onError) listening.catch(onError)
    return proxy
  }
}

/**
 * Pipes `from` into `to` with backpressure and ties their lifetimes together: an end is passed on as a
 * half-close, an error resets the other side, and a socket that closes early takes the other one down.
 */
function forward (from, to, onError) {
  from.pipe(to)
  from.on('error', (err) => {
    to.resetAndDestroy()
    onError?.(err)
  })
  from.on('close', () => {
    // Once both directions have ended, `to` flushes what is left and closes by itself.
    if (!from.readableEnded || !to.readableEnded) to.destroy()
  })
}

module.exports = SimpleTcpProxy
// Node's ESM loader only sees assigned names, so this lets `import { run }` work as the typings promise.
module.exports.run = SimpleTcpProxy.run
