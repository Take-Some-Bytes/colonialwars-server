/* eslint-env node */
/**
 * @fileoverview ErrorHandlers class for controlling the handling of application errors.
 */

import * as errors from '../errors.js'
import { ErrorSender } from '../utils/server-utils.js'

/**
 * @typedef {Object} ErrorHandlersConfig
 * @prop {import('../logging/loggers')} loggers
 */

/**
 * ErrorHandlers class.
 */
export default class ErrorHandlers {
  /**
   * Constructor for an ErrorHandler class.
   * @param {ErrorHandlersConfig} config Configurations.
   */
  constructor (config) {
    const { loggers } = config

    this.loggers = loggers
  }

  /**
   * Handles a CORS error (class ``CorsError``).
   * @returns {import('router').ErrorHandler}
   */
  handleCorsError () {
    const self = this

    return function corsError (err, req, res, next) {
      const reqID = req.id || 'unknown'
      const errSender = new ErrorSender({ response: res })
      const logMsg = [
        `Request [${reqID}]: failed CORS check. `,
        `Origin ${req.headers.origin} is not allowed.`
      ].join('')
      const securityLogger = self.loggers.get('Security-logger')

      if (err instanceof errors.CorsError && err.code === 'ECORS') {
        errSender.sendErrorAndLog(
          'CORS check failed.', securityLogger,
          { logMsg, status: 403 }
        )
      } else {
        next()
      }
    }
  }
}
