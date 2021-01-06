/* eslint-env node */
/**
 * @fileoverview ErrorHandlers class for controlling the handling of application errors.
 */

/**
 * @typedef {Object} ErrorHandlersConfig
 * @prop {InstanceType<import('../utils/server-utils')>} serverUtils
 */

const errors = require('../errors')

/**
 * ErrorHandlers class.
 */
class ErrorHandlers {
  /**
   * Constructor for an ErrorHandler class.
   * @param {ErrorHandlersConfig} config Configurations.
   */
  constructor (config) {
    const { serverUtils } = config

    this.serverUtils = serverUtils
  }

  /**
   * Handles a CORS error (class ``CorsError``).
   * @returns {import('router').ErrorHandler}
   */
  handleCorsError () {
    return (err, req, res, next) => {
      /**
       * @type {string}
       */
      const reqIP = req.ip || 'Unknown IP'
      if (err instanceof errors.CorsError && err.code === 'ECORS') {
        this.serverUtils.sendError({
          httpOpts: {
            status: 403
          },
          logOpts: {
            doLog: true,
            loggerID: 'Security-logger',
            logLevel: 'notice',
            logMessage: `${reqIP} got blocked by CORS policy.`
          },
          message: 'Not allowed by CORS!'
        })
        // res.statusCode = 403
        // res.setHeader('Content-Type', 'text/plain')
        // res.end('Not allowed by CORS!')
      } else {
        next()
      }
    }
  }
}

module.exports = exports = ErrorHandlers
