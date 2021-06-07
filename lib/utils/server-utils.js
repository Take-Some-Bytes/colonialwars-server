/* eslint-env node */
/**
 * @fileoverview Server utility methods.
 */

const net = require('net')

/**
 * @typedef {Object} SendErrorOpts Options.
 * @prop {Object} [httpOpts]
 * @prop {number} [httpOpts.status=500] HTTP status code. Default is 500.
 * @prop {string} [httpOpts.contentType="text/plain"] HTTP content type. Default
 * is ``text/plain``.
 * @prop {Object} [logOpts]
 * @prop {string} [logOpts.logMessage=""] The message to log. No default.
 * @prop {boolean} [logOpts.doLog=false] Whether to log or not to log.
 * Default is false.
 * @prop {string} [logOpts.loggerID] The ID of the winston logger to use.
 * @prop {string} [logOpts.logLevel] The level to log at.
 * @prop {string} [message] The message to send.
 * Default is ``Failed with status ${statusCode}``.
 *
 * @typedef {Object} ServerUtilsConfig
 * @prop {import('../logging/loggers').LoggersInterface} loggers
 * @prop {import('debug').Debugger} debug
 *
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
 * ServerUtils class.
 */
class ServerUtils {
  /**
   * Initialize ServerUtils.
   * @param {ServerUtilsConfig} config Configurations.
   */
  constructor (config) {
    const { loggers, debug } = config

    this.debug = debug
    this.loggers = loggers
  }

  /**
   * Sends an error to the client.
   * @param {SendErrorOpts} [opts] Options.
   * @returns {import('router').HandleHandler}
   */
  sendError (opts) {
    /**
     * Defaults for the options.
     * @type {SendErrorOpts}
     */
    const defaults = {
      httpOpts: {
        status: 500,
        contentType: 'text/plain'
      },
      logOpts: {
        doLog: false
      },
      message: null
    }
    // Create an internal `_opts` variable to actually use
    // without modifying the original `opts` parameter.
    /**
     * @type {SendErrorOpts}
     */
    let _opts = {}

    // No options? let's go to defaults.
    if (!opts) {
      _opts = defaults
    } else {
      // Lots of option determination.
      _opts = {
        httpOpts: opts.httpOpts
          ? {
              status: opts.httpOpts.status || defaults.httpOpts.status,
              contentType: opts.httpOpts.contentType || defaults.httpOpts.contentType
            }
          : defaults.httpOpts,
        logOpts: opts.logOpts
          ? {
              doLog: opts.logOpts.doLog || defaults.logOpts.doLog,
              logMessage: opts.logOpts.logMessage,
              loggerID: opts.logOpts.loggerID,
              logLevel: opts.logOpts.logLevel
            }
          : defaults.logOpts,
        message: opts.message
          ? opts.message
          : null
      }
    }

    return (req, res) => {
      this.debug(
        `Sending error to client with status code ${_opts.httpOpts.status}` +
        `, who requested ${req.url}.`
      )
      // Check if we need to log or not.
      if (_opts.logOpts.doLog) {
        const log = this.loggers
          .get(_opts.logOpts.loggerID)[
            _opts.logOpts.logLevel
          ]
        if (typeof log === 'function') {
          log(_opts.logOpts.logMessage)
        }
      }

      res.statusCode = _opts.httpOpts.status
      res.setHeader('Content-Type', _opts.httpOpts.contentType)
      res.end(!_opts.message
        ? `Failed with status ${_opts.httpOpts.status}.`
        : _opts.message
      )
    }
  }
}

module.exports = exports = ServerUtils

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
