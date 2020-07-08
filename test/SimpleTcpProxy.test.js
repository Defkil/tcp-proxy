const { describe, it } = require('mocha');
const net = require('net');
const Proxy = require('../src/SimpleTcpProxy.js');
require('chai').should();

const testString = 'testIt123';
const preFixPort = 10000;

describe('index', () => {
  it('create a class proxy and start/stop the proxy', (done) => {
    const proxy = new Proxy({ proxy: { host: '127.0.0.1', port: Number(preFixPort + 1) }, target: { host: '127.0.0.1', port: preFixPort } });
    const socket = new net.Socket();
    proxy.status.should.equal('offline');

    const server = net.createServer((sock) => {
      sock.on('data', (data) => {
        data.toString().should.equal(testString);
        proxy.status.should.equal('online');
        proxy.close();
        proxy.status.should.equal('offline');
        sock.write(testString);
      });
    }).listen(preFixPort, '127.0.0.1');

    proxy.start(() => {
      proxy.status.should.equal('online');
      socket.destroy();
      server.close();
      done();
    });
    proxy.status.should.equal('offline');

    socket.connect(preFixPort + 1, '127.0.0.1');
    socket.write(testString);
  });

  it('create a one line proxy and send a message', (done) => {
    let proxy;
    let socket;
    const server = net.createServer((sock) => {
      sock.on('data', (data) => {
        data.toString().should.equal(testString);
        proxy.status.should.equal('online');
        proxy.close();
        Object.keys(proxy.client_con).length.should.equal(0);
        proxy.status.should.equal('offline');
        server.close();
        socket.destroy();
        done();
      });
    }).listen(preFixPort + 20, '127.0.0.1', () => {
      proxy = Proxy.run({ proxy: { host: '127.0.0.1', port: preFixPort + 21 }, target: { host: '127.0.0.1', port: preFixPort + 20 } });
      socket = new net.Socket();
      socket.connect(preFixPort + 21, '127.0.0.1');
      socket.write(testString);
    });
  });

  it('test proxy close function', (done) => {
    const proxy = Proxy.run({ proxy: { host: '127.0.0.1', port: preFixPort + 31 }, target: { host: '127.0.0.1', port: preFixPort + 30 } });

    let mockCounter = 0;
    const mockObj = { destroy() { mockCounter += 1; } };
    const mockCallback = 'mockCallback';

    proxy.status = 'online'; // fake status
    proxy.server = {
      close: (callback) => {
        callback.should.equal(mockCallback);
        mockCounter.should.equal(proxy.client_con.length - 1); // one corrupted obj (42)
        done();
      },
    };
    proxy.client_con = [mockObj, mockObj, mockObj, mockObj, mockObj, 42];

    proxy.close(mockCallback);
  });

  it('create proxy without parameters', (done) => {
    const server = net.createServer((sock) => {
      sock.on('data', (data) => {
        data.toString().should.equal(testString);
        sock.write(testString);
      });
    }).listen(preFixPort + 40, '127.0.0.1');

    const proxy = new Proxy({ proxy: { host: '127.0.0.1', port: preFixPort + 41 }, target: { host: '127.0.0.1', port: preFixPort + 40 } });
    proxy.status.should.equal('offline');
    proxy.start();
    proxy.status.should.equal('offline');

    const socket = new net.Socket();
    socket.connect(preFixPort + 41, '127.0.0.1');
    socket.write(testString);

    socket.on('data', (data) => {
      data.toString().should.equal(testString);
      proxy.status.should.equal('online');

      Object.keys(proxy.client_con).forEach((key) => {
        proxy.client_con[key].readable.should.equal(true);
      });
      server.close();
      socket.destroy();
      proxy.close();
      done();
    });
  });
});
