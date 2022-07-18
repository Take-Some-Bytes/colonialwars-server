/* eslint-env jasmine */
/**
 * @fileoverview Testing server utility methods.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

import { ErrorSender } from '../../lib/utils/server-utils.js'

import MockResponse from '../mocks/external/mock-http-response.js'

/**
 * @callback LogError
 * @param {string} err
 * @returns {void}
 */

/**
 * Prepares an error sender, without logging.
 * @returns {[InstanceType<MockResponse>, ErrorSender]}
 */
function prepSender () {
  const res = new MockResponse()
  const errSender = new ErrorSender({ response: res })

  return [res, errSender]
}
/**
 * Prepares an error sender, with logging.
 * @returns {[{ error: jasmine.Spy<LogError> }, InstanceType<MockResponse>, ErrorSender]}
 */
function prepSenderWithLogging () {
  const [res, errSender] = prepSender()

  return [
    { error: jasmine.createSpy('error', () => {}).and.callThrough() },
    res, errSender
  ]
}

describe('The ErrorSender class,', () => {
  describe('when not logging,', () => {
    it('should be able to send an error with defaults', () => {
      const [res, errSender] = prepSender()

      errSender.sendError('Error!')

      expect(res.statusCode).toBe(500)
      expect(res.headers['Content-Type']).toBe('application/json')
      expect(res.responseContent).toBeInstanceOf(Buffer)
      expect(JSON.parse(res.responseContent.toString('utf-8'))).toEqual({
        status: 'error',
        error: { message: 'Error!' }
      })
    })
    it('should be able to send an empty error message', () => {
      const [res, errSender] = prepSender()

      errSender.sendError('')

      expect(res.statusCode).toBe(500)
      expect(res.headers['Content-Type']).toBe('application/json')
      expect(res.responseContent).toBeInstanceOf(Buffer)
      expect(JSON.parse(res.responseContent.toString('utf-8'))).toEqual({
        status: 'error',
        error: { message: '' }
      })
    })
    it('should be able to send the specified HTTP status', () => {
      const [res, errSender] = prepSender()

      errSender.sendError('Not Found!', 404)

      expect(res.statusCode).toBe(404)
      expect(res.headers['Content-Type']).toBe('application/json')
      expect(res.responseContent).toBeInstanceOf(Buffer)
      expect(JSON.parse(res.responseContent.toString('utf-8'))).toEqual({
        status: 'error',
        error: { message: 'Not Found!' }
      })
    })
    it('should be able to stringify non-string error messages', () => {
      const [res, errSender] = prepSender()

      errSender.sendError({})

      expect(res.statusCode).toBe(500)
      expect(res.headers['Content-Type']).toBe('application/json')
      expect(res.responseContent).toBeInstanceOf(Buffer)
      expect(JSON.parse(res.responseContent.toString('utf-8'))).toEqual({
        status: 'error',
        error: { message: '[object Object]' }
      })
    })
  })

  describe('when logging,', () => {
    it('should accept a logger and log the error message', () => {
      const [logger, res, errSender] = prepSenderWithLogging()

      errSender.sendErrorAndLog('Error!', logger)

      expect(res.statusCode).toBe(500)
      expect(res.headers['Content-Type']).toBe('application/json')
      expect(res.responseContent).toBeInstanceOf(Buffer)
      expect(JSON.parse(res.responseContent.toString('utf-8'))).toEqual({
        status: 'error',
        error: { message: 'Error!' }
      })
      expect(logger.error).toHaveBeenCalledWith('Error!')
    })
    it('should be able to send the specified status code', () => {
      const [logger, res, errSender] = prepSenderWithLogging()

      errSender.sendErrorAndLog('Not Found!', logger, { status: 404 })

      expect(res.statusCode).toBe(404)
      expect(res.headers['Content-Type']).toBe('application/json')
      expect(res.responseContent).toBeInstanceOf(Buffer)
      expect(JSON.parse(res.responseContent.toString('utf-8'))).toEqual({
        status: 'error',
        error: { message: 'Not Found!' }
      })
      expect(logger.error).toHaveBeenCalledWith('Not Found!')
    })
    it('should be able to log the specified log message', () => {
      const [logger, res, errSender] = prepSenderWithLogging()

      errSender.sendErrorAndLog('Error!', logger, { logMsg: 'Something bad happened.' })

      expect(res.statusCode).toBe(500)
      expect(res.headers['Content-Type']).toBe('application/json')
      expect(res.responseContent).toBeInstanceOf(Buffer)
      expect(JSON.parse(res.responseContent.toString('utf-8'))).toEqual({
        status: 'error',
        error: { message: 'Error!' }
      })
      expect(logger.error).toHaveBeenCalledWith('Something bad happened.')
    })
    it('should be able to send the specified status AND log the specified message', () => {
      const [logger, res, errSender] = prepSenderWithLogging()

      errSender.sendErrorAndLog(
        'TOO MANY!!!',
        logger,
        { logMsg: 'Client tried to do this too many times', status: 413 }
      )

      expect(res.statusCode).toBe(413)
      expect(res.headers['Content-Type']).toBe('application/json')
      expect(res.responseContent).toBeInstanceOf(Buffer)
      expect(JSON.parse(res.responseContent.toString('utf-8'))).toEqual({
        status: 'error',
        error: { message: 'TOO MANY!!!' }
      })
      expect(logger.error).toHaveBeenCalledWith('Client tried to do this too many times')
    })
  })
})
