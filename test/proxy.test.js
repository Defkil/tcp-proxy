'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const net = require('node:net')
const { once } = require('node:events')
const { randomBytes } = require('node:crypto')
const SimpleTcpProxy = require('..')

const host = '127.0.0.1'

/** Starts a server on a free port and tears it down after the test. */
async function listen (t, onConnection = () => {}, options = {}) {
  const sockets = new Set()
  const server = net.createServer(options, (socket) => {
    sockets.add(socket)
    onConnection(socket)
  })
  server.listen(0, host)
  await once(server, 'listening')
  t.after(() => {
    for (const socket of sockets) socket.destroy()
    server.close()
  })
  return { server, port: server.address().port }
}

/** Starts a proxy to `targetPort` on a free port and closes it after the test. */
async function startProxy (t, targetPort, onConnection, onError) {
  const proxy = new SimpleTcpProxy({ proxy: { host, port: 0 }, target: { host, port: targetPort } })
  await proxy.start(onConnection, onError)
  t.after(() => proxy.close())
  return { proxy, port: proxy.server.address().port }
}

/** An onConnection callback plus a promise for the proxy-side sockets of the first connection. */
function nextConnection () {
  let onConnection
  const connection = new Promise((resolve) => {
    onConnection = (client, target) => resolve({ client, target, closed: closed(client, target) })
  })
  return { onConnection, connection }
}

function closed (...sockets) {
  return Promise.all(sockets.map((socket) => once(socket, 'close')))
}

async function connect (port) {
  const socket = net.connect({ host, port })
  await once(socket, 'connect')
  return socket
}

/** Collects everything the socket receives until the other side ends. */
async function readAll (socket) {
  const chunks = []
  socket.on('data', (chunk) => chunks.push(chunk))
  await once(socket, 'end')
  return Buffer.concat(chunks)
}

/** A port that nothing listens on. */
async function closedPort () {
  const server = net.createServer().listen(0, host)
  await once(server, 'listening')
  const { port } = server.address()
  server.close()
  await once(server, 'close')
  return port
}

test('forwards data in both directions', async (t) => {
  const { port: targetPort } = await listen(t, (socket) => socket.pipe(socket))
  const { port } = await startProxy(t, targetPort)

  const client = await connect(port)
  client.end('ping')

  assert.equal((await readAll(client)).toString(), 'ping')
})

test('passes the sockets of every connection to onConnection', async (t) => {
  const { port: targetPort } = await listen(t, (socket) => socket.end('pong'))
  const { onConnection, connection } = nextConnection()
  const { port } = await startProxy(t, targetPort, onConnection)

  const client = await connect(port)
  const sockets = await connection
  const seen = readAll(sockets.target)

  assert.ok(sockets.client instanceof net.Socket)
  assert.equal((await readAll(client)).toString(), 'pong')
  assert.equal((await seen).toString(), 'pong')
})

test('applies backpressure instead of buffering for a slow client', async (t) => {
  const payload = randomBytes(32 * 1024 * 1024)
  const { port: targetPort } = await listen(t, (socket) => socket.end(payload))
  const { onConnection, connection } = nextConnection()
  const { port } = await startProxy(t, targetPort, onConnection)

  const client = net.connect({ host, port }).pause()
  const sockets = await connection
  await once(sockets.target, 'pause')

  const buffered = sockets.client.writableLength
  assert.ok(buffered < 1024 * 1024, `the proxy buffered ${buffered} bytes`)
  const received = readAll(client)
  client.resume()
  assert.ok((await received).equals(payload))
})

test('passes a half-close on and still delivers the answer', async (t) => {
  const { port: targetPort } = await listen(t, async (socket) => {
    socket.end(`got ${await readAll(socket)}`)
  }, { allowHalfOpen: true })
  const { port } = await startProxy(t, targetPort)

  const client = await connect(port)
  client.end('ping')

  assert.equal((await readAll(client)).toString(), 'got ping')
})

test('closes the client connection when the target closes', async (t) => {
  const { port: targetPort } = await listen(t, (socket) => socket.end())
  const { onConnection, connection } = nextConnection()
  const { proxy, port } = await startProxy(t, targetPort, onConnection)

  const client = await connect(port)
  const clientClosed = closed(client)
  await (await connection).closed
  await clientClosed

  assert.deepEqual(proxy.client_con, {})
})

test('closes the target connection when the client closes', async (t) => {
  const { server, port: targetPort } = await listen(t)
  const accepted = once(server, 'connection')
  const { onConnection, connection } = nextConnection()
  const { proxy, port } = await startProxy(t, targetPort, onConnection)

  const client = await connect(port)
  const [socket] = await accepted
  const targetClosed = closed(socket)
  client.end()
  await (await connection).closed
  await targetClosed

  assert.deepEqual(proxy.client_con, {})
})

test('resets the client and reports the error when the target is unreachable', async (t) => {
  const errors = []
  const { port } = await startProxy(t, await closedPort(), undefined, (err) => errors.push(err))

  const client = net.connect({ host, port })
  const [err] = await once(client, 'error')

  assert.equal(err.code, 'ECONNRESET')
  assert.deepEqual(errors.map((error) => error.code), ['ECONNREFUSED'])
})

test('resets the target and reports the error when the client resets', async (t) => {
  const { server, port: targetPort } = await listen(t)
  const accepted = once(server, 'connection')
  const errors = []
  const { port } = await startProxy(t, targetPort, undefined, (err) => errors.push(err))

  const client = await connect(port)
  const [socket] = await accepted
  const targetError = once(socket, 'error')
  client.resetAndDestroy()
  const [err] = await targetError

  assert.equal(err.code, 'ECONNRESET')
  assert.deepEqual(errors.map((error) => error.code), ['ECONNRESET'])
})

test('close() closes open connections and stops listening', async (t) => {
  const { server, port: targetPort } = await listen(t)
  const accepted = once(server, 'connection')
  const proxy = new SimpleTcpProxy({ proxy: { host, port: 0 }, target: { host, port: targetPort } })
  await proxy.start()
  const { port } = proxy.server.address()

  const client = await connect(port)
  const [socket] = await accepted
  const connectionClosed = closed(client, socket)
  assert.equal(proxy.status, 'online')
  assert.equal(Object.keys(proxy.client_con).length, 1)

  let calledBack = false
  await proxy.close(() => { calledBack = true })
  await connectionClosed

  assert.ok(calledBack)
  assert.equal(proxy.status, 'offline')
  assert.equal(proxy.server, undefined)
  assert.deepEqual(proxy.client_con, {})
  await assert.rejects(connect(port), { code: 'ECONNREFUSED' })
})

test('close() is safe before start(), twice, and while starting', async () => {
  const proxy = new SimpleTcpProxy({ proxy: { host, port: 0 }, target: { host, port: 1 } })
  await proxy.close()

  const listening = proxy.start()
  const closing = proxy.close()
  await listening
  await Promise.all([closing, proxy.close()])

  assert.equal(proxy.status, 'offline')
  assert.equal(proxy.server, undefined)
})

test('start() reports the listening state and rejects a second start', async (t) => {
  const proxy = new SimpleTcpProxy({ proxy: { host, port: 0 }, target: { host, port: 1 } })
  assert.equal(proxy.status, 'offline')

  await proxy.start()
  t.after(() => proxy.close())

  assert.equal(proxy.status, 'online')
  await assert.rejects(proxy.start(), /already started/)
})

test('start() rejects when the port is taken and can be retried', async (t) => {
  const { server, port: taken } = await listen(t)
  const proxy = new SimpleTcpProxy({ proxy: { host, port: taken }, target: { host, port: taken } })

  await assert.rejects(proxy.start(), { code: 'EADDRINUSE' })
  assert.equal(proxy.status, 'offline')

  server.close()
  await once(server, 'close')
  await proxy.start()
  t.after(() => proxy.close())
  assert.equal(proxy.status, 'online')
})

test('run() starts a proxy and passes listen errors to onError', async (t) => {
  const { port: targetPort } = await listen(t, (socket) => socket.end('pong'))
  const proxy = SimpleTcpProxy.run({ proxy: { host, port: 0 }, target: { host, port: targetPort } })
  t.after(() => proxy.close())
  assert.ok(proxy instanceof SimpleTcpProxy)
  await once(proxy.server, 'listening')

  const client = await connect(proxy.server.address().port)
  assert.equal((await readAll(client)).toString(), 'pong')

  const taken = proxy.server.address().port
  const err = await new Promise((resolve) => {
    SimpleTcpProxy.run({ proxy: { host, port: taken }, target: { host, port: targetPort } }, undefined, resolve)
  })
  assert.equal(err.code, 'EADDRINUSE')
})

test('run() also works on its own and as an ESM named import', async (t) => {
  const { run } = SimpleTcpProxy
  const esm = await import('../index.js')
  assert.equal(esm.default, SimpleTcpProxy)
  assert.equal(esm.run, run)

  const proxy = run({ proxy: { host, port: 0 }, target: { host, port: 1 } })
  t.after(() => proxy.close())
  assert.ok(proxy instanceof SimpleTcpProxy)
})

test('rejects options without a valid target port', () => {
  assert.throws(() => new SimpleTcpProxy({ proxy: { port: 0 }, target: { host } }), TypeError)
  assert.throws(() => new SimpleTcpProxy({ proxy: { port: 0 }, target: { port: 70000 } }), TypeError)
  assert.throws(() => new SimpleTcpProxy({ target: { port: 80 } }), TypeError)
  assert.doesNotThrow(() => new SimpleTcpProxy({ proxy: { port: 0 }, target: { port: '8080' } }))
})
