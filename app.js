var net = require('net')
module.client_list = []

/**
 * Create a Redis Hogan Cache
 *
 * @param {Object}   options                  Settings for the proxy
 * @param {Object}   options.proxy            Proxy server information
 * @param {Object}   options.proxy.host       Proxy IP
 * @param {Object}   options.proxy.port       Proxy Port
 * @param {Object}   options.target           Target server information
 * @param {Object}   options.target.host      Target IP
 * @param {Object}   options.target.port      Target Port    
 * @param {Function} callback(proxySock, clientSock) 
 * @param {Function}    error(error)          [Optional] errorhandler
 */
module.exports = function (options, callback, error) {
    net.createServer(function(sock) {
        
        module.sock = sock
        
        sock.id = Math.floor(Math.random() * 100000)
        module.client_list[sock.id] = new net.Socket()

        module.client_list[sock.id].connect(options.target.port, options.target.host, error)

        sock.removeAllListeners('data')

        sock.on('data', function(data) {
            module.client_list[sock.id].write(data)
        })

        module.client_list[sock.id].on('data', function(data) {
            sock.write(data)
        })

        sock.on('close', function(data) {
            module.client_list[sock.id].destroy()
        })
        
        module.client_list[sock.id].on('error', error)
        sock.on('error', error)
        
        callback(sock, module.client_list[sock.id])
    }).listen(options.proxy.port, options.proxy.host)
}