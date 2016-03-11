dirty-rpc -- expose functions as http calls
===========================================

## Install

    npm install dirty-rpc

## Start the RPC server

```javascript

import Promise from 'bluebird'
import http from 'http'
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

```javascript
import {client} from 'dirty-rpc'

// Create a proxy for the readFile function on the RPC server
const readFile = client('http://localhost:3000', 'readFile')

// RPC proxies always return a promise
readFile('some_file.txt')
  .then(content => { /**/ })
  .catch(err => { /**/ })
```

# Error handling

All server errors result in a JSON reply of:

```json
{
  "error": {
    "message": "error message",
    "stack": "error stack trace"
  }
}
```

This is deserialized into an Error object and the client proxy rejects the promise with it. Specific error types are not preserved.
