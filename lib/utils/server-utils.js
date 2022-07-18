/* eslint-env node */
/**
 * @fileoverview Server utility methods.
 */

import { Socket } from 'net'

/**
 * @typedef {Object} ErrorSenderOpts
 * @prop {import('http').ServerResponse} [response]
 * @prop {import('net').Socket} [socket]
 *
 * @typedef {Object} SendAndLogOpts
 * @prop {number} [status=500] The HTTP status code to send. Default is 500.
 * @prop {string} [logMsg] The message to log. Default is the same as the
 * error message sent to the client.
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
    if (opts.socket instanceof Socket) {
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
   * Sends an error and logs a message, using the specified logger. Always logs
   * with the 'error' level.
   * @param {string} msg The error message.
   * @param {import('winston').Logger} logger The logger to use.
   * @param {SendAndLogOpts} opts Options.
   */
  sendErrorAndLog (msg, logger, opts) {
    opts = {
      status: opts?.status || 500,
      logMsg: opts?.logMsg || msg
    }

    logger.error(opts.logMsg)

    this.sendError(msg, opts.status)
  }
}

const _ErrorSender = ErrorSender
export { _ErrorSender as ErrorSender }
