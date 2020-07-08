const { describe, it } = require('mocha');
require('chai').should();
const proxyquire = require('proxyquire');
const {
  errorListener, dataListener, closeListener,
} = require('../src/helper');

const netStub = {};
const helperWithNetMock = proxyquire('../src/helper', { net: netStub });
const testString = 'testIt123';

describe('helper', () => {
  it('test error listener', () => {
    let mockCounter = 0;
    function mockFunction(num) {
      mockCounter += num;
    }
    errorListener(mockFunction)(5);
    mockCounter.should.equal(5);
    errorListener()(5); // should change nothing
    mockCounter.should.equal(5);
  });

  it('test data listener', () => {
    let mockMsg;
    const mockSocket = {};
    mockSocket.write = (data) => {
      mockMsg = data;
    };
    dataListener(mockSocket)(testString);
    mockMsg.should.equal(testString);
    dataListener()('newString');
    mockMsg.should.equal(testString);
  });

  it('test close listener', () => {
    let mockCounter = 0;
    const mockSocket = {};
    mockSocket.destroy = () => {
      mockCounter += 1;
    };
    closeListener(mockSocket)();
    mockCounter.should.equal(1);
  });

  it('test getSocket', () => {
    let mockPort;
    let mockHost;
    netStub.Socket = class {
      // eslint-disable-next-line class-methods-use-this
      connect(port, host) {
        mockPort = port;
        mockHost = host;
      }
    };
    helperWithNetMock.getSocket('testPort', 'testHost');
    mockPort.should.equal('testPort');
    mockHost.should.equal('testHost');
  });
});
