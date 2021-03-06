/* eslint-env node */
/**
 * @fileoverview Class for middleware functions.
 */

const cors = require('cors')
const morgan = require('morgan')
const accepts = require('accepts')
const { nanoid } = require('nanoid')
const cookieParser = require('cookie-parser')
const forwardedParse = require('forwarded-parse')

const { ErrorSender } = require('../utils/server-utils')

/**
 * @typedef {Object} MiddlwareConfig
 * @prop {number} URL_MAX_LEN
 * @prop {cors.CorsOptions} corsOpts
 * @prop {import('stream').Writable} requestLoggerStream
 * @prop {InstanceType<import('../logging/loggers')>} loggers
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
      URL_MAX_LEN,
      corsOpts,
      requestLoggerStream,
      loggers
    } = config

    this.loggers = loggers
    this.corsOpts = corsOpts
    this.URL_MAX_LEN = URL_MAX_LEN
    this.requestLoggerStream = requestLoggerStream
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
    return (_, res, next) => {
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
   * Parses a querystring.
   * @returns {import('router').NextHandler}
   */
  queryParser () {
    return (req, res, next) => {
      // We'll use example.com, just because we won't be needing to know
      // the actual host/hostname.
      const url = new URL(req.url, 'http://example.com')
      req.query = url.searchParams
      next()
    }
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
      } catch (ex) { /* Ignore the error. */ }
      next()
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
   * Gives a request an ID.
   * @returns {import('router').NextHandler}
   */
  requestID () {
    return async (req, res, next) => {
      req.id = nanoid()
      next()
    }
  }

  /**
   * Logs a request.
   * @returns {import('router').NextHandler}
   */
  logRequest () {
    morgan.token('req-id', req => {
      if (req.id) {
        return req.id
      }

      return 'unknown'
    })
    const logFormat = [
      'Request [:req-id]: ',
      '":method :url HTTP/:http-version", responded',
      ' with :status in :response-time[1] ms'
    ].join('')

    return morgan(logFormat, {
      stream: this.requestLoggerStream
    })
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
      const reqID = req.id || 'unknown'
      const reqUrlLength = req.url.length
      const errSender = new ErrorSender({
        request: req, response: res, loggers: this.loggers
      })

      if (reqUrlLength > this.URL_MAX_LEN) {
        const logMsg = [
          `Request [${reqID}]: exceeded maximum URL length of`,
          ` ${this.URL_MAX_LEN}.`
        ].join('')

        errSender.sendErrorAndLog(
          'URL too long.', 'Security-logger', logMsg, 414
        )
        return
      } else if (!implementedMethods.includes(req.method)) {
        const logMsg = [
          `Request [${reqID}]: used unimplemented ${req.method}.`
        ].join('')

        errSender.sendErrorAndLog(
          `${req.method} is not implemented.`, 'Server-logger', logMsg, 501
        )
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
      const accept = accepts(req)
      const reqID = req.id || 'unknown'
      const errSender = new ErrorSender({
        request: req, response: res, loggers: this.loggers
      })
      // We only send JSON, deal with it.
      const acceptedTypes = ['application/json']

      if (accept.types(acceptedTypes)) {
        next()
        return
      }

      const logMsg = [
        `Request [${reqID}]: does not accept application/json.`
      ].join('')

      // Otherwise, return a 406 Not Acceptable.
      errSender.sendErrorAndLog(
        'Content negotiation failed.', 'Server-logger', logMsg, 406
      )
    }
  }
}

module.exports = Middlewares
