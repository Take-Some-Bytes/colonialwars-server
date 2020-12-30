/* eslint-env node */
/**
 * @fileoverview Server utility methods.
 */

/**
 * @typedef {Object} SendErrorOpts Options.
 * @prop {Object} [httpOpts]
 * @prop {number} [httpOpts.status=500] HTTP status code. Default is 500.
 * @prop {Object} [logOpts]
 * @prop {string} [logOpts.logMessage=""] The message to log. No default.
 * @prop {boolean} [logOpts.doLog=false] Whether to log or not to log.
 * Default is false.
 * @prop {string} [logOpts.loggerID] The ID of the winston logger to use.
 * @prop {string} [logOpts.logLevel] The level to log at.
 * @prop {string} [message] The message to send. Must be in plain text format.
 * Default is ``Failed with status ${statusCode}``.
 *
 * @typedef {Object} ServerUtilsConfig
 * @prop {import('../logging/loggers').LoggersInterface} loggers
 * @prop {import('debug').Debugger} debug
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
        status: 500
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
              status: opts.httpOpts.status || defaults.httpOpts.status
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
      res.setHeader('Content-Type', 'text/plain')
      res.end(!_opts.message
        ? `Failed with status ${_opts.httpOpts.status}.`
        : _opts.message
      )
    }
  }
}

module.exports = exports = ServerUtils
