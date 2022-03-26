/* eslint-env node */
/**
 * @fileoverview Server utility methods.
 */

const net = require('net')

/**
 * @typedef {Object} ErrorSenderOpts
 * @prop {import('http').IncomingMessage} [request]
 * @prop {import('http').ServerResponse} [response]
 * @prop {import('net').Socket} [socket]
 * @prop {RequestInfo} [requestInfo]
 * @prop {InstanceType<import('../logging/loggers')>} loggers
 * @prop {string} [logPrefix]
 *
 * @typedef {Object} RequestInfo
 * @prop {string} url
 * @prop {string} id
 */

/**
 * ErrorSender class.
 *
 * The ErrorSender class sends HTTP errors, with logging if needed.
 */
class ErrorSender {
  /**
   * Constructor for an ErrorSender class.
   * @param {ErrorSenderOpts} opts Options.
   */
  constructor (opts) {
    if (opts.socket instanceof net.Socket) {
      throw new Error('Using a net.Socket is not supported yet')
    } else {
      this.response = opts.response
      this.resWriter = {
        /**
         * Set the HTTP status code.
         * @param {number} status
         */
        setStatus: (status) => {
          this.response.statusCode = status
        },
        /**
         * Set a HTTP header.
         * @param {string} name
         * @param {string|number|readonly string[]} value
         */
        setHeader: (name, value) => {
          this.response.setHeader(name, value)
        },
        /**
         * Write some data.
         * @param {any} chunk
         */
        write: (chunk) => {
          return this.response.write(chunk)
        },
        /**
         * Ends this response
         * @param {any} [chunk]
         */
        end: (chunk) => {
          this.response.end(chunk)
        }
      }
      this.reqInfo = opts.request
      this.loggers = opts.loggers

      this.logPrefix = opts.logPrefix || ''
    }
  }

  /**
   * Sends an error with the specified message. Does not log.
   * @param {string} msg The error message.
   * @param {number} [status=500] The HTTP status code to send. Default 500.
   */
  sendError (msg, status = 500) {
    if (typeof msg !== 'string') {
      msg = Object.prototype.toString.call(msg)
    }
    const data = JSON.stringify({
      status: 'error',
      error: { message: msg }
    })
    this.resWriter.setStatus(status || 500)
    this.resWriter.setHeader('Content-Type', 'application/json')
    this.resWriter.setHeader('Content-Length', Buffer.byteLength(data))
    this.resWriter.write(data)
    this.resWriter.end()
  }

  /**
   * Sends an error and logs a message, using the logger that has the specified
   * logger ID. If the logger doesn't exist, does the same as ``.sendError``.
   * Always log with the 'error' level.
   * @param {string} msg The error message.
   * @param {string} loggerID The ID of the logger to use.
   * @param {string} [logMsg] The message to log. Default is the value of ``msg``.
   * @param {number} [status] The HTTP status code to send. Default 500.
   */
  sendErrorAndLog (msg, loggerID, logMsg, status = 500) {
    const logger = this.loggers.get(loggerID)
    if (logger) {
      logger.error(`${this.logPrefix}${logMsg}` || msg)
    }

    this.sendError(msg, status)
  }
}

exports.ErrorSender = ErrorSender
