dirty-rpc -- expose functions as http calls
===========================================

## Install

    npm install dirty-rpc

## Start the RPC server

```javascript
import Promise from 'bluebird'
import http from 'http'
import fs from 'fs'
import {httpListener} from 'dirty-rpc'

const listener = httpListener({

  // Any function can be a request handler as long as it accepts and returns JSON data.
  // The only exception is if the function is async, in which case it should return a promise
  // that resolves with JSON data. The RPC server will respond with the result of the promise.
  readFile (name) {
    return Promise.fromCallback(callback => fs.readFile(name, 'utf-8', callback))
  }
})

http.createServer(listener).listen(3000, 'localhost', () => {
  console.log('RPC server listening...')
})
```

or using Express:

```javascript
import express from 'express'

/* ... */

const app = express()
app.post('/', listener)
app.listen(3000, 'localhost', () => {
  console.log('RPC server listening...')
})
```

## Call a remote function

The RPC client module takes care only of serializing and deserializing rpc request and response data.
It doesn't make network requests. This keeps it independent of the transport layer and allows clients to
use the library of their choice for transmitting the data. The example below uses [request](https://www.npmjs.com/package/request).

```javascript
import request from 'request'
import Promise from 'bluebird'
import {client} from 'dirty-rpc'

function makeRequest (payloadString) {
  const reqOpts = {
    method: 'POST',
    url: 'http://localhost:3000',
    body: payloadString,
  }

  // return a promise that resolves with the rpc response data
  return Promise.fromCallback(
    callback => request(reqOpts, callback),
    {multiArgs: true}
  )
    .spread((response, body) => body)
}

// Create a proxy for the readFile function on the RPC server
const readFile = client(makeRequest, 'readFile')

// RPC proxies always return a promise
readFile('some_file.txt')
  .then(content => {
    console.log('content: ', content)
  })
  .catch(err => {
    console.log('remote err: ', err)
  })
```

# Error handling

All RPC errors result in a JSON reply of:

```json
{
  "error": {
    "message": "error message",
    "stack": "error stack trace"
  }
}
```

This is deserialized into an Error object and the client proxy rejects the promise with it. Specific error types are not preserved.
