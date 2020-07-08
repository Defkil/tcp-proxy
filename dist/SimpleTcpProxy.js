"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var net = require('net');

var _require = require('uuid'),
    uuidv4 = _require.v4;

var _require2 = require('./helper'),
    errorListener = _require2.errorListener,
    dataListener = _require2.dataListener,
    closeListener = _require2.closeListener,
    getSocket = _require2.getSocket;

var SimpleTcpProxy = /*#__PURE__*/function () {
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
  function SimpleTcpProxy(options) {
    _classCallCheck(this, SimpleTcpProxy);

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


  _createClass(SimpleTcpProxy, [{
    key: "start",
    value: function start(callback, error) {
      var _this = this;

      this.server = net.createServer(function (sock) {
        // creating tcp proxy server
        // setting up a new connection to the target server
        var socket = getSocket(_this.target.port, _this.target.host);
        sock.removeAllListeners('data');
        sock.on('data', dataListener(socket)); // bind data listener

        socket.on('data', dataListener(sock));
        sock.on('error', errorListener(error)); // bind error listener

        socket.on('error', errorListener(error));
        sock.on('close', closeListener()); // bind listener for close

        _this.status = 'online'; // set online status

        _this.client_con[uuidv4()] = socket; // store connection

        if (callback) callback(sock, socket); // running callback
      }).listen(this.proxy.port, this.proxy.host); // start server
    }
    /**
     * shut down the server and run callback
     *
     * @param {Function} [callback]
     */

  }, {
    key: "close",
    value: function close(callback) {
      var _this2 = this;

      Object.keys(this.client_con).forEach(function (key) {
        // destroying all connections
        if (typeof _this2.client_con[key].destroy === 'function') _this2.client_con[key].destroy();
        _this2.client_con[key] = undefined;
        delete _this2.client_con[key];
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

  }], [{
    key: "run",
    value: function run(options, callback, errorFunc) {
      var proxy = new this(options); // create new proxy

      proxy.start(callback, errorFunc); // start proxy

      return proxy;
    }
  }]);

  return SimpleTcpProxy;
}();

module.exports = SimpleTcpProxy;