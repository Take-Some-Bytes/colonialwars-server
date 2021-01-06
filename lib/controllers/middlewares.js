/* eslint-env node */
/**
 * @fileoverview Class for middleware functions.
 */

const cors = require('cors')
const cookieParser = require('cookie-parser')
const forwardedParse = require('forwarded-parse')
const ParseError = require('forwarded-parse/lib/error')

/**
 * @typedef {Object} MiddlwareConfig
 * @prop {number} URL_MAX_LEN
 * @prop {InstanceType<import('../utils/server-utils')>} serverUtils
 * @prop {import('debug').Debugger} debug
 * @prop {cors.CorsOptions} corsOpts
 *
 * @typedef {Object} AcceptOpts
 * @prop {Array<string>} type
 * @prop {Array<string>} lang
 * @prop {Array<string>} charset
 * @prop {Array<string>} encoding
 * @prop {boolean} ignoreAcceptMismatch
 *
 * @typedef {Object} CheckAcceptOpts
 * @prop {"type"|"lang"|"charset"|"encoding"} whichAccept
 * @prop {Array<string>} acceptedTypes
 *
 * @typedef {Object} ExpectCtOptions
 * @prop {number} [maxAge]
 * @prop {boolean} [enforce]
 * @prop {string} [reportUri]
 *
 * @typedef {Object} GetClientIPOpts
 * @prop {boolean} behindProxy
 * @prop {Array<string>} trustedIPs
 *
 */

/**
 * Middlewares class.
 */
class Middlewares {
  /**
   * Initializes middleware functions.
   * @param {MiddlwareConfig} config Configurations.
   */
  constructor (config) {
    const {
      serverUtils,
      URL_MAX_LEN,
      debug,
      corsOpts
    } = config

    this.debug = debug
    this.corsOpts = corsOpts
    this.serverUtils = serverUtils
    this.URL_MAX_LEN = URL_MAX_LEN
  }

  /**
   * Checkpoint for CORS.
   * @returns {import('router').NextHandler}
   */
  corsCheckpoint () {
    return cors(this.corsOpts)
  }

  /**
   * Sets the CSP header.
   * @returns {import('router').NextHandler}
   */
  setCSPHeader () {
    return (req, res, next) => {
      // This one simple CSP directive is not enough for us to use helmet.
      res.setHeader('Content-Security-Policy', "default-src 'none'")
      next()
    }
  }

  /**
   * Parses cookies.
   * @param {string} secret The cookie secret for signed cookies.
   * @returns {import('router').NextHandler}
   */
  cookieParser (secret) {
    return cookieParser(secret)
  }

  /**
   * Parses the ``"Forwarded"`` HTTP header, if it exists and is valid.
   * @returns {import('router').NextHandler}
   */
  forwardedParser () {
    return (req, res, next) => {
      const hasForwarded =
        req.headers.forwarded !== undefined && req.headers.forwarded !== null

      if (!hasForwarded) {
        // Forwarded header doesn't exist, NEXT!
        next()
        return
      }
      try {
        const forwardedValue = forwardedParse(req.headers.forwarded)
        req.forwardedRecords = forwardedValue
        next()
      } catch (ex) {
        if (ex instanceof ParseError) {
          // Forwarded header is invalid, ignore it. NEXT!
          next()
        } else {
          // Don't know what type of error would happen here,
          // so we'll send a 500 Internal Server Error.
          this.serverUtils.sendError({
            httpOpts: {
              status: 500
            },
            logOpts: {
              doLog: true,
              loggerID: 'Server-logger',
              logLevel: 'error',
              logMessage:
                `Error while parsing Forwarded header. Error is: ${ex.stack}.`
            },
            message: 'Internal Server Error.'
          })(req, res, next)
        }
      }
    }
  }

  /**
   * Tries to get the true client IP.
   * @param {GetClientIPOpts} opts Options.
   * @returns {import('router').NextHandler}
   */
  getClientIP (opts) {
    return (req, res, next) => {
      // Taken from is_js.
      // https://github.com/arasatasaygin/is.js/blob/master/is.js#L341 and
      // https://github.com/arasatasaygin/is.js/blob/master/is.js#L342.
      const ipRegexes = {
        ipv4: /^(?:(?:\d|[1-9]\d|1\d{2}|2[0-4]\d|25[0-5])\.){3}(?:\d|[1-9]\d|1\d{2}|2[0-4]\d|25[0-5])$/,
        ipv6: /^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i
      }
      /**
       * @type {ReturnType<forwardedParse>}
       */
      const forwardedRecords = req.forwardedRecords
      const xForwardedFor = req.headers['x-forwarded-for']
      const socketIP = req.socket.remoteAddress

      // If opts.behindProxy is false, just set req.ip as socketIP or null.
      if (!opts.behindProxy) {
        req.ip = socketIP || null
        next()
        return
      }

      if (forwardedRecords instanceof Array) {
        const firstRecord = forwardedRecords[0]
        if (
          typeof firstRecord.for === 'string' &&
          (ipRegexes.ipv4.test(firstRecord.for) || ipRegexes.ipv6.test(firstRecord.for)) &&
          // Make sure the proxy is trusted.
          opts.trustedIPs.includes(firstRecord.by) && socketIP === firstRecord.by
        ) {
          req.ip = firstRecord.for
          next()
          return
        }
      }
      if (typeof xForwardedFor === 'string') {
        const values = xForwardedFor.split(',').map(str => str.trim())
        const firstIP = values[0]

        if (
          typeof firstIP === 'string' &&
          (ipRegexes.ipv4.test(firstIP) || ipRegexes.ipv6.test(firstIP)) &&
          // Make sure the proxy is trusted.
          opts.trustedIPs.includes(socketIP)
        ) {
          req.ip = firstIP
          next()
          return
        }
      }
      if (
        typeof socketIP === 'string' &&
        (ipRegexes.ipv4.test(socketIP) || ipRegexes.ipv6.test(socketIP))
      ) {
        req.ip = socketIP
        next()
        return
      }
      // Welp, we can't find the IP, so set it as null.
      req.ip = null
      next()
    }
  }

  /**
   * Logs a request. For development only.
   * @returns {import('router').NextHandler}
   */
  logRequest () {
    return (req, res, next) => {
      this.debug(
        `${new Date().toISOString()}: Request received for ${req.url}, using method ${req.method}.`
      )
      next()
    }
  }

  /**
   * System part of HTTP decision making.
   * @param {Array<string>} implementedMethods Array of methods that this
   * server supports. Must be all upper-case.
   * @returns {import('router').NextHandler}
   */
  sysCheckpoint (implementedMethods) {
    implementedMethods = implementedMethods
      .filter(val => typeof val === 'string')
      .map(val => val.toUpperCase())

    return (req, res, next) => {
      /**
       * @type {string}
       */
      const reqIP = req.ip || 'Unknown IP'
      const reqUrlLength = req.url.length

      if (reqUrlLength > this.URL_MAX_LEN) {
        this.serverUtils.sendError({
          httpOpts: {
            status: 414
          },
          logOpts: {
            doLog: true,
            logLevel: 'notice',
            loggerID: 'Security-logger',
            logMessage:
            `${reqIP} tried to get a page on this server with a very ` +
            `long request URL. URL that they tried to get: ${req.url}`
          },
          message: 'URL too long.'
        })(req, res, next)
        return
      } else if (!implementedMethods.includes(req.method)) {
        this.serverUtils.sendError({
          httpOpts: {
            status: 501
          },
          logOpts: {
            doLog: true,
            logLevel: 'error',
            loggerID: 'Server-logger',
            logMessage:
            `${reqIP} tried using method ${req.method}, which is not implemented.`
          },
          message: `${req.method} is not implemented.`
        })(req, res, next)
        return
      }
      next()
    }
  }

  /**
   * Checkpoint for the accept part of HTTP decision making.
   * @returns {import('router').NextHandler}
   */
  acceptCheckpoint () {
    return (req, res, next) => {
      const acceptedTypeRegex = /^(?:text|application|\*)\/(?:plain|json|\*)$/i
      const hasAccept =
        req.headers.accept !== null && req.headers.accept !== undefined
      const reqIP = req.ip || 'Unknown IP'

      if (!hasAccept) {
        // If the Accept header is not present, treat it as */*.
        next()
        return
      }
      // This is not configurable, because this project's
      // API endpoints only return text and JSON.
      if (
        req.headers.accept
          .split(',')
          .map(val => val.trim())
          .some(val => acceptedTypeRegex.test(val))
      ) {
        // We're fine.
        next()
        return
      }

      // Otherwise, return a 406 Not Acceptable.
      this.serverUtils.sendError({
        httpOpts: {
          status: 406
        },
        logOpts: {
          doLog: true,
          logLevel: 'error',
          loggerID: 'Server-logger',
          logMessage:
            `${reqIP} failed content negotiation.`
        },
        message: 'Content negotiation failed.'
      })(req, res, next)
    }
  }
}

module.exports = exports = Middlewares
