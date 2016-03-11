/* eslint-env mocha */
import {expect} from 'chai'
import {PassThrough} from 'stream'
import httpListener from './http_listener'

function getResponseStub () {
  const responseStub = new PassThrough()
  responseStub.setHeader = function (name, value) {
    this.headers = this.headers || {}
    this.headers[name] = value
  }
  return responseStub
}

function getRpcRequest (method, params) {
  return JSON.stringify({method, params})
}

function getSuccessData (result) {
  return {result}
}

function getErrorData (err) {
  const errorData = {
    message: err.message,
    stack: err.stack,
  }
  return {error: errorData}
}

function expectResponse (response, expectedData) {
  return new Promise(resolve => {
    let responseBody

    // this assumes only one chunk but it's fine for now
    response
      .on('data', chunk => {
        responseBody = chunk
      })
      .on('end', () => {
        expect(response.statusCode, 'status code').to.equal(200)
        expect(response.headers, 'response headers').to.deep.equal({
          'Content-Type': 'application/json',
        })

        const responseData = JSON.parse(responseBody)
        if (expectedData) {
          expect(responseData, 'response data').to.deep.equal(expectedData)
        }

        resolve(responseData)
      })
  })
}

describe('http listener', function () {
  beforeEach(function () {
    this.requestStub = new PassThrough()
    this.responseStub = getResponseStub()
  })

  it('should handle request errors', function () {
    const listener = httpListener({sum: () => {}})
    listener(this.requestStub, this.responseStub)

    const requestErr = new Error('cannot parse request')
    this.requestStub.emit('error', requestErr)

    return expectResponse(this.responseStub, getErrorData(requestErr))
  })

  it('should handler unknown function calls', function () {
    const listener = httpListener()
    listener(this.requestStub, this.responseStub)

    const requestBody = getRpcRequest('unknown')
    this.requestStub.end(requestBody)

    return expectResponse(this.responseStub)
      .then(responseData => {
        expect(responseData, 'rpc response').to.not.have.property('result')
        expect(responseData.error, 'error').to.include.keys('message', 'stack')
      })
  })

  it('should call sync request handlers', function () {
    function sum (a, b) {
      return a + b
    }
    const listener = httpListener({sum})
    listener(this.requestStub, this.responseStub)

    const requestBody = getRpcRequest('sum', [1, 2])
    const chunk1 = requestBody.substr(0, requestBody.length)
    const chunk2 = requestBody.substr(requestBody.length)
    this.requestStub.write(chunk1)
    this.requestStub.end(chunk2)

    return expectResponse(this.responseStub, getSuccessData(3))
  })

  it('should handle sync request handler errors', function () {
    const sumErr = new Error('cannot add numbers')
    function sum (a, b) {
      throw sumErr
    }
    const listener = httpListener({sum})
    listener(this.requestStub, this.responseStub)

    const requestBody = getRpcRequest('sum', [1, 2])
    this.requestStub.end(requestBody)

    return expectResponse(this.responseStub, getErrorData(sumErr))
  })

  it('should call async request handlers', function () {
    function sum (a, b) {
      return Promise.resolve(a + b)
    }
    const listener = httpListener({sum})
    listener(this.requestStub, this.responseStub)

    const requestBody = getRpcRequest('sum', [1, 2])
    this.requestStub.end(requestBody)

    return expectResponse(this.responseStub, getSuccessData(3))
  })

  it('should handle async request handler errors', function () {
    const sumErr = new Error('cannot add numbers')
    function sum (a, b) {
      return Promise.reject(sumErr)
    }
    const listener = httpListener({sum})
    listener(this.requestStub, this.responseStub)

    const requestBody = getRpcRequest('sum', [1, 2])
    this.requestStub.end(requestBody)

    return expectResponse(this.responseStub, getErrorData(sumErr))
  })
})
