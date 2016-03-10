/* eslint-env mocha */
import {expect} from 'chai'
import {PassThrough} from 'stream'
import server from './server'

function getRequestStub (url) {
  const requestStub = new PassThrough()
  requestStub.url = url
  return requestStub
}

function getResponseStub () {
  const responseStub = new PassThrough()
  responseStub.setHeader = function (name, value) {
    this.headers = this.headers || {}
    this.headers[name] = value
  }
  return responseStub
}

function getErrorData (err) {
  return {
    message: err.message,
    stack: err.stack,
  }
}

function expectResponse (response, expectedStatus, expectedData) {
  return new Promise(resolve => {
    let responseBody

    // this assumes only one chunk but it's fine for now
    response
      .on('data', chunk => {
        responseBody = chunk
      })
      .on('end', () => {
        expect(response.statusCode, 'status code').to.equal(expectedStatus)
        expect(response.headers, 'response headers').to.deep.equal({
          'Content-Type': 'application/json',
        })

        const responseData = JSON.parse(responseBody)
        if (expectedData) {
          expect(responseData, 'response data').to.deep.equal(expectedData)
        } else {
          expect(responseData, 'response data').to.be.ok
        }

        resolve()
      })
  })
}

describe('rpc server', function () {
  beforeEach(function () {
    this.requestStub = getRequestStub('/sum')
    this.responseStub = getResponseStub()
  })

  it('should handle request errors', function () {
    // call the server's request handler with stub data
    const listener = server({sum: () => {}})
    listener(this.requestStub, this.responseStub)

    const requestErr = new Error('cannot parse request')
    this.requestStub.emit('error', requestErr)

    return expectResponse(this.responseStub, 500, getErrorData(requestErr))
  })

  it('should handler unknown function calls', function () {
    const listener = server()
    listener(this.requestStub, this.responseStub)

    return expectResponse(this.responseStub, 501)
  })

  it('should call sync request handlers', function () {
    function sum (a, b) {
      return a + b
    }
    const listener = server({sum})
    listener(this.requestStub, this.responseStub)

    const sumArgs = [1, 2]
    const requestBody = JSON.stringify(sumArgs)
    const bodyChunks = requestBody.split(',')
    this.requestStub.emit('data', new Buffer(bodyChunks[0]))
    this.requestStub.emit('data', new Buffer(','))
    this.requestStub.emit('data', new Buffer(bodyChunks[1]))
    this.requestStub.emit('end')

    return expectResponse(this.responseStub, 200, {result: 3})
  })

  it('should handle sync request handler errors', function () {
    const sumErr = new Error('cannot add numbers')
    function sum (a, b) {
      throw sumErr
    }
    const listener = server({sum})
    listener(this.requestStub, this.responseStub)

    const sumArgs = [1, 2]
    const requestBody = JSON.stringify(sumArgs)
    this.requestStub.emit('data', new Buffer(requestBody))
    this.requestStub.emit('end')

    return expectResponse(this.responseStub, 500, getErrorData(sumErr))
  })

  it('should call async request handlers', function () {
    function sum (a, b) {
      return Promise.resolve(a + b)
    }
    const listener = server({sum})
    listener(this.requestStub, this.responseStub)

    const sumArgs = [1, 2]
    const requestBody = JSON.stringify(sumArgs)
    this.requestStub.emit('data', new Buffer(requestBody))
    this.requestStub.emit('end')

    return expectResponse(this.responseStub, 200, {result: 3})
  })

  it('should handle async request handler errors', function () {
    const sumErr = new Error('cannot add numbers')
    function sum (a, b) {
      return Promise.reject(sumErr)
    }
    const listener = server({sum})
    listener(this.requestStub, this.responseStub)

    const sumArgs = [1, 2]
    const requestBody = JSON.stringify(sumArgs)
    this.requestStub.emit('data', new Buffer(requestBody))
    this.requestStub.emit('end')

    return expectResponse(this.responseStub, 500, getErrorData(sumErr))
  })
})
