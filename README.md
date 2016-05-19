# Simple TCP Proxy module


Require simple-tcp-proxy
```javascript
var proxy = require('simple-tcp-proxy')
```

Create a proxy
```javascript
proxy({proxy:{host:'127.0.0.1', port:25565}, target:{host:'127.0.0.1', port:25566}}
  , function(server, client){
    //object from proxy (tcp server)
    server.on('data',  function(data){
        console.log(data)
    })
    
    //object from client (client to target server)
    client.on('data',  function(data){
        console.log(data)
    })
}, function(error){
    //optional errorhandler
    console.log(error)
})
```

Simple Proxy
```javascript
proxy({proxy:{host:'127.0.0.1', port:25565}, target:{host:'127.0.0.1', port:25566}})
```

