const net = require('net');
/** @module helper */

/**
 * create a listener which runs the parameter function with the data from the listener
 *
 * @param {function(Error)} errorFunction function to run inside the return function
 * @return {function(Error)} errorListener runs errorFunction with own parameter
 */
function errorListener(errorFunction) {
  return /** @param {Error} errMsg Error Msg */ (errMsg) => {
    if (errorFunction) errorFunction(errMsg);
  };
}

/**
 * create a listener which writes the data to the socket
 *
 * @param {module:net.Socket} socket socket where the data is written to
 * @return {function((Uint8Array | string))} listener which writes data to the socket
 */
function dataListener(socket) {
  return (data) => { if (socket) socket.write(data); };
}

/**
 * destroys the socket it the Listener is fired
 *
 * @param {module:net.Socket} socket to destroy
 * @return {function()} listener which will destroy the socket
 */
function closeListener(socket) {
  return () => { if (socket) socket.destroy(); };
}

/**
 * create a socket to given parameter
 *
 * @param {Number} port port of the server
 * @param {String} host host of the server
 * @return {module:net.Socket}
 */
function getSocket(port, host) {
  const socket = new net.Socket();
  socket.connect(port, host);
  return socket;
}

module.exports = {
  errorListener, dataListener, closeListener, getSocket,
};
