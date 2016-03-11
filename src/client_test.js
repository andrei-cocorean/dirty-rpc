/* eslint-env mocha */
import {stub} from 'sinon'
import 'sinon-as-promised'

import chai, {expect} from 'chai'
import sinonChai from 'sinon-chai'
import chaiAsPromised from 'chai-as-promised'

import client from './client'

chai.use(sinonChai)
  .use(chaiAsPromised)

export function rpcRequest (method, params) {
  return JSON.stringify({method, params})
}

export function successResponse (result) {
  return JSON.stringify({result})
}

export function errorResponse (err) {
  const errorData = {
    message: err.message,
    stack: err.stack,
  }
  return JSON.stringify({error: errorData})
}

describe('rpc client', function () {
  beforeEach(function () {
    this.makeRequestStub = stub()
    this.sumProxy = client(this.makeRequestStub, 'sum')
  })

  it('should delegate making the request to its callback', function () {
    this.makeRequestStub.resolves()
    this.sumProxy(1, 2)

    expect(this.makeRequestStub, 'make request').to.be.calledWith(rpcRequest('sum', [1, 2]))
  })

  it('should return the remote call result', function () {
    this.makeRequestStub.resolves(successResponse(3))
    const result = this.sumProxy(1, 2)

    return expect(result, 'rpc result').to.eventually.equal(3)
  })

  it('should throw the remote call error', function () {
    const remoteErr = new Error('numbers too big')
    this.makeRequestStub.resolves(errorResponse(remoteErr))
    const result = this.sumProxy(1, 2)

    return expect(result, 'rpc result').to.be.rejectedWith('numbers too big')
  })

  it('should throw transport layer errors', function () {
    const requestErr = new Error('host not found')
    this.makeRequestStub.rejects(requestErr)
    const result = this.sumProxy(1, 2)

    return expect(result, 'rpc result').to.be.rejectedWith(requestErr)
  })
})
