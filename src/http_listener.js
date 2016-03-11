/**
 * Returns a request listener that dispatches calls to the handlers.
 *
 * Any function can be a handler as long as it accepts and returns JSON data.
 * The only exception to this rule is if the function is asynchronous in which case
 * it should return a Promise that will resolve with JSON data.
 *
 * @param  {object}                       handlers a mapping function_name -> handler
 * @return {function (request, response)}
 */
export default function server (handlers = {}) {
  return function rpcListener (request, response) {
    const replyError = getErrorReplier(response)
    request.on('error', err => replyError(err))
    response.on('error', err => console.error(err))

    const bodyChunks = []
    request
      .on('data', chunk => {
        bodyChunks.push(chunk)
      })
      .on('end', () => {
        const body = Buffer.concat(bodyChunks).toString()
        const {method, params} = JSON.parse(body)
        const requestHandler = handlers[method]
        if (!requestHandler) return replyError(new Error(`No such function: ${method}`))

        const reply = getReplier(response)
        handleRequest(requestHandler, params, reply, replyError)
      })
  }
}

/**
 * Returns a function that sends an rpc error back to the client.
 *
 * @param  {http.ServerResponse}        response
 * @return {function (err, statusCode)}
 */
function getErrorReplier (response) {
  return function replyError (err) {
    const errorData = {
      message: err.message,
      stack: err.stack,
    }
    send(response, {error: errorData})
  }
}

/**
 * Returns a function that sends a success result back to the client.
 *
 * @param  {http.ServerResponse} response
 * @return {function (result)}
 */
function getReplier (response) {
  return function reply (result) {
    send(response, {result})
  }
}

/**
 * Prepares the respone and sends the data to the client.
 *
 * @param  {http.ServerResponse} response
 * @param  {json}                data
 */
function send (response, data) {
  response.statusCode = 200
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(data))
}

/**
 * Delegates to the request handler and returns the result to the client.
 *
 * @param  {function} handler    request handler
 * @param  {array}    params     array of parameters for the handler
 * @param  {function} reply      a function that sends a success reply to the client
 * @param  {function} replyError a function that sends an error reply to the client
 */
function handleRequest (handler, params, reply, replyError) {
  try {
    const result = handler(...params)
    if (result && typeof result.then === 'function') {
      result.then(reply).catch(replyError)
    } else {
      reply(result)
    }
  } catch (err) {
    replyError(err)
  }
}
