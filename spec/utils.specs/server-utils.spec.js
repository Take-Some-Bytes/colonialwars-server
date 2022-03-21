/* eslint-env jasmine */
/**
 * @fileoverview Testing server utility methods.
 */

const ServerUtils = require('../../lib/utils/server-utils')

const MockLoggers = require('../mocks/internal/mock-loggers')
const MockHttpRequest = require('../mocks/external/mock-http-request')
const MockHttpResponse = require('../mocks/external/mock-http-response')

describe('The ServerUtils class,', () => {
  const mockLoggers = new MockLoggers()
  let serverUtils = null

  it('should construct without error', () => {
    let err = null
    try {
      serverUtils = new ServerUtils({
        loggers: mockLoggers,
        debug: function (...args) { /** Swallow */ }
      })
    } catch (ex) {
      err = ex
    }

    expect(err).toBe(null)
    expect(serverUtils).toBeInstanceOf(ServerUtils)
  })

  it('should be able to send an error (with default opts)', () => {
    const mockReq = new MockHttpRequest({
      url: '/i-errored-out'
    })
    const mockRes = new MockHttpResponse()

    if (serverUtils instanceof ServerUtils) {
      serverUtils.sendError()(mockReq, mockRes, null)
    }

    expect(mockRes.statusCode).toBe(500)
    expect(mockRes.writableEnded).toBe(true)
    expect(mockRes.headers['Content-Type']).toBe('text/plain')
    expect(mockRes.responseContent).toBeInstanceOf(Buffer)
    expect(mockRes.responseContent.toString('utf-8')).toBe('Failed with status 500.')
  })

  it('should be able to send (and log) an error (with custom opts)', () => {
    const mockReq = new MockHttpRequest({
      url: '/error-me'
    })
    const mockRes = new MockHttpResponse()

    if (serverUtils instanceof ServerUtils) {
      serverUtils.sendError({
        httpOpts: {
          status: 404
        },
        logOpts: {
          doLog: true,
          logLevel: 'error',
          loggerID: 'Server-logger',
          logMessage: 'ENOENT: Open file /srv/public/error-me.html'
        },
        message: 'File not found.'
      })(mockReq, mockRes, null)
    }

    expect(mockRes.statusCode).toBe(404)
    expect(mockRes.writableEnded).toBe(true)
    expect(mockRes.headers['Content-Type']).toBe('text/plain')
    expect(mockRes.responseContent).toBeInstanceOf(Buffer)
    expect(mockRes.responseContent.toString('utf-8')).toBe('File not found.')
  })
})
