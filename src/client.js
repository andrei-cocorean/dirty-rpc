/**
 * Returns a remote function proxy. The proxy takes care of serializing
 * and deserializing the rpc request and response, it does not make
 * the request itself.
 *
 * The request data is passed to the makeRequest parameter where the client
 * can use whatever transport layer he wants.
 *
 * makeRequest is a function (string) -> Promise(string)
 *
 * It receives the rpc request string to be sent and returns a promise that resolves
 * with the rpc response string.
 *
 * @param  {function} makeRequest callback that sends and receives the request and response data
 * @param  {string} fnName        the remote function name
 * @return {promise}              will be resolved/rejected with the rpc result/error
 */
export default function rpcClient (makeRequest, fnName) {
  return function remoteFnProxy (...args) {
    const request = getRequest(fnName, args)
    return makeRequest(request)
      .then(parseRpcResponse)
  }
}

function getRequest (method, params) {
  return JSON.stringify({method, params})
}

function parseRpcResponse (responseStr) {
  const response = JSON.parse(responseStr)
  if (response.hasOwnProperty('result')) return response.result

  throw deserializeError(response.error)
}

function deserializeError ({message, stack}) {
  const rpcError = new Error(message)
  rpcError.stack = stack
  return rpcError
}
