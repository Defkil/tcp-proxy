[![NPM](https://nodei.co/npm/simple-tcp-proxy.png)](https://www.npmjs.com/package/simple-tcp-proxy)

[![NPM](https://badgen.net/badge/icon/npm?icon=npm&label)](https://www.npmjs.com/package/simple-tcp-proxy)
[![Github](https://badgen.net/badge/icon/github?icon=github&label)](https://github.com/Defkil/tcp-proxy)
[![Docs](https://badgen.net/badge/docs/online/blue)](https://defkil.github.io/tcp-proxy)
[![Build Status](https://travis-ci.org/Defkil/tcp-proxy.svg?branch=master)](https://travis-ci.org/Defkil/tcp-proxy)
[![Coverage Status](https://coveralls.io/repos/github/Defkil/tcp-proxy/badge.svg?branch=master)](https://coveralls.io/github/Defkil/tcp-proxy?branch=master) 
[![Known Vulnerabilities](https://snyk.io/test/github/Defkil/tcp-proxy/badge.svg?targetFile=package.json)](https://snyk.io/test/github/Defkil/tcp-proxy?targetFile=package.json)
[![dependencies Status](https://david-dm.org/defkil/tcp-proxy/status.svg)](https://david-dm.org/defkil/tcp-proxy)

# Simple TCP Proxy module for NodeJS

Require simple-tcp-proxy
```javascript
const SimpleTcpProxy = require('simple-tcp-proxy')
```

Create a proxy with a function
```javascript
const proxy = new SimpleTcpProxy({proxy:{host:'127.0.0.1', port:25565}, target:{host:'127.0.0.1', port:25566}});
proxy.start(function(server, client){ // optional callback will be called with every new connection
    // object from proxy (tcp server)
    server.on('data',  function(data){
        console.log(data);
    });
    
    // object from client (client to target server)
    client.on('data',  function(data){
        console.log(data);
    });
}, function(error){
    // optional error handler
    console.log(error);
});

console.log(proxy.status); // print proxy status (online/offline)
console.log(proxy.client_con); // print an object with all connections
console.log(proxy.socket) // print proxy server socket
```

one line proxy
```javascript
proxy.run({proxy:{host:'127.0.0.1', port:25565}, target:{host:'127.0.0.1', port:25566}})
```

all scripts in package.json are not available over npm only over github

## changed to update 2.0.0
```javascript
// old (v1.0.0) version (won't work!)
require('simple-tcp-proxy')({proxy: {}, target: {}}, ()=> {}, ()=> {})

// new version
require('simple-tcp-proxy').run({proxy: {}, target: {}}, ()=> {}, ()=> {})

// or with a class
const proxy = new require('simple-tcp-proxy')({proxy: {}, target: {}})
proxy.start()
```
