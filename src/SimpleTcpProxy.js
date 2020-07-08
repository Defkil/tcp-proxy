const net = require('net');
const { v4: uuidv4 } = require('uuid');
const {
  errorListener, dataListener, closeListener, getSocket,
} = require('./helper');

class SimpleTcpProxy {
  /**
   * saves proxy and target information, set status to offline and init client_con obj
   *
   * @param {Object} options             Settings for the proxy
   * @param {Object} options.proxy       Proxy server information
   * @param {String} options.proxy.host  Proxy IP
   * @param {Number} options.proxy.port  Proxy Port
   * @param {Object} options.target      Target server information
   * @param {String} options.target.host Target IP
   * @param {Number} options.target.port Target Port
   */
  constructor(options) {
    this.proxy = options.proxy; // host and port from proxy server
    this.target = options.target; // host and port from target server
    this.status = 'offline'; // server status
    this.client_con = {}; // obj for storing all connections
  }

  /**
   * start function of the proxy
   * create a new TCP Server
   * gives every new client a uuid
   * bind listener from proxy and target
   * run callback after every connection
   *
   * @param {Function} callback [opt] func will be called with every new con
   * @param {Function} error [opt] error handler
   */
  start(callback, error) {
    this.server = net.createServer((sock) => { // creating tcp proxy server
      // setting up a new connection to the target server
      const socket = getSocket(this.target.port, this.target.host);
      sock.removeAllListeners('data');

      sock.on('data', dataListener(socket)); // bind data listener
      socket.on('data', dataListener(sock));

      sock.on('error', errorListener(error)); // bind error listener
      socket.on('error', errorListener(error));

      sock.on('close', closeListener()); // bind listener for close

      this.status = 'online'; // set online status
      this.client_con[uuidv4()] = socket; // store connection
      if (callback) callback(sock, socket); // running callback
    }).listen(this.proxy.port, this.proxy.host); // start server
  }

  /**
   * shut down the server and run callback
   *
   * @param {Function} [callback]
   */
  close(callback) {
    Object.keys(this.client_con).forEach((key) => { // destroying all connections
      if (typeof this.client_con[key].destroy === 'function') this.client_con[key].destroy();
      this.client_con[key] = undefined;
      delete this.client_con[key];
    });
    this.status = 'offline'; // set server status to offline
    this.server.close(callback); // close server and run callback
  }

  /**
   * static one line function to create a proxy (like in the first version)
   *
   * @param {Object} options             Settings for the proxy
   * @param {Object} options.proxy       Proxy server information
   * @param {String} options.proxy.host  Proxy IP
   * @param {Number} options.proxy.port  Proxy Port
   * @param {Object} options.target      Target server information
   * @param {String} options.target.host Target IP
   * @param {Number} options.target.port Target Port
   * @param {function(module:net.Socket, module:net.Socket)} [callback]
   * callback(proxySocket, clientSocket) => {}; runs after every new connection
   * @param {function} [errorFunc] error handler
   */
  static run(options, callback, errorFunc) {
    const proxy = new this(options); // create new proxy
    proxy.start(callback, errorFunc); // start proxy
    return proxy;
  }
}

module.exports = SimpleTcpProxy;
