/* eslint-env jasmine */
/**
 * @fileoverview Specs for error handlers.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

import * as errors from '../../lib/errors.js'
import ErrorHandlers from '../../lib/controllers/errorhandlers.js'

import MockLoggers from '../mocks/internal/mock-loggers.js'
import MockRequest from '../mocks/external/mock-http-request.js'
import MockResponse from '../mocks/external/mock-http-response.js'

describe('The ErrorHandlers class,', () => {
  describe('the CORS error handler,', () => {
    it('should not do anything if error is not a CorsError', () => {
      const err = new Error('Something bad happened!')
      const req = new MockRequest({
        headers: { origin: 'http://somewhere-else.com' }
      })
      const res = new MockResponse()
      const loggers = new MockLoggers()
      spyOn(loggers, 'log').and.callThrough()

      const errHandlers = new ErrorHandlers({ loggers })
      const corsErrHandler = errHandlers.handleCorsError()

      let nextCalled = false

      corsErrHandler(err, req, res, () => { nextCalled = true })

      expect(nextCalled).toBeTrue()
      expect(loggers.log).not.toHaveBeenCalled()
    })

    it('should send an erro and log a message if error is a CorsError', () => {
      const err = new errors.CorsError("CORS didn't work!")
      const req = new MockRequest({
        headers: { origin: 'http://somewhere-else.com' }
      })
      const res = new MockResponse()
      const loggers = new MockLoggers()
      spyOn(loggers, 'log').and.callThrough()

      const errHandlers = new ErrorHandlers({ loggers })
      const corsErrHandler = errHandlers.handleCorsError()

      let nextCalled = false

      corsErrHandler(err, req, res, () => { nextCalled = true })

      expect(nextCalled).toBeFalse()
      expect(loggers.log).toHaveBeenCalled()
      expect(res.statusCode).toBe(403)
      expect(res.responseContent).toBeInstanceOf(Buffer)
      expect(JSON.parse(res.responseContent.toString('utf-8'))).toEqual({
        status: 'error',
        error: { message: 'CORS check failed.' }
      })
    })
  })
})
