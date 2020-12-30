/* eslint-env node */
/**
 * @fileoverview Loggers class.
 */

const winston = require('winston')
const winstonSyslog = require('winston-syslog')
const Syslog = winstonSyslog.Syslog

/**
 * @typedef {Object} WinstonTransports
 * @prop {winston.transports.ConsoleTransportInstance|null} consoleTransport
 * @prop {Syslog|null} syslogTransport
 *
 * @typedef {Object} LoggerInfo
 * @prop {string} id
 * @prop {string} label
 *
 * @typedef {Object} LoggingConfig
 * @prop {boolean} isProd
 * @prop {import('debug').Debugger} debug
 * @prop {Array<LoggerInfo>} loggerInfos
 * @prop {winstonSyslog.SyslogTransportOptions} syslogOpts
 * @prop {winston.config.AbstractConfigSetLevels} levels
 * @prop {Object<string, string>} colors
 *
 * @typedef {Object} LoggersInterface
 * @prop {import('debug').Debugger} debug
 * @prop {(id: string) => winston.Logger} get
 */

/**
 * Loggers class.
 */
class Loggers {
  /**
   * Constructor for a Loggers class.
   * @param {LoggingConfig} config Configurations.
   */
  constructor (config) {
    const {
      isProd, loggerInfos,
      debug, syslogOpts,
      levels, colors
    } = config

    // Keep an array of logger IDs so that we could get
    // all the loggers stored here easily.
    this.loggerIDs = []

    this.debug = debug
    this.loggers = new winston.Container()
    this.logLevels = levels
    this.logColors = colors
    this.logFormat = winston.format.printf(info => {
      // Use process.title just to be much clearer what process
      // these logs are originating from.
      return (
        `${process.title}: ${info.timestamp}` +
        ` [${info.label}] ${info.level}: ${info.message}`
      )
    })
    this.init(isProd, loggerInfos, syslogOpts)
  }

  /**
   * Creates the winston transports.
   * @param {boolean} isProd Whether the app is in production or not.
   * @param {winstonSyslog.SyslogTransportOptions} [syslogOpts] Syslog options,
   * if in production.
   * @returns {WinstonTransports}
   * @private
   */
  _createTransports (isProd, syslogOpts) {
    const consoleTransport =
      new winston.transports.Console({
        // I want to use CRLF.
        eol: '\r\n',
        level: 'debug'
      })
    if (isProd) {
      if (
        typeof syslogOpts !== 'object' ||
        typeof syslogOpts.constructor !== 'function' ||
        syslogOpts.constructor !== Object
      ) {
        throw new TypeError(
          'If production mode is enabled, must pass syslog options!'
        )
      }
      this.debug(
        `Created syslog transport with options ${JSON.stringify(syslogOpts, null, 2)}`
      )
      return {
        consoleTransport: null,
        syslogTransport: new Syslog(syslogOpts)
      }
    }
    this.debug('Returning console only transports.')
    return {
      consoleTransport: consoleTransport,
      syslogTransport: null
    }
  }

  /**
   * Initializes this Loggers class.
   * @param {boolean} isProd Whether the app is in production or not.
   * @param {Array<LoggerInfo>} loggerInfos Logger info.
   * @param {winstonSyslog.SyslogTransportOptions} syslogOpts Syslog options,
   * if in production.
   */
  init (isProd, loggerInfos, syslogOpts) {
    const transports = this._createTransports(isProd, syslogOpts)
    winston.addColors(this.logColors)
    loggerInfos.forEach(loggerInfo => {
      // Use console transports only if not in production.
      const currentTransports = [transports.consoleTransport]
      if (isProd) {
        currentTransports.shift()
        currentTransports.push(transports.syslogTransport)
      }
      this.loggerIDs.push(loggerInfo.id)
      this.loggers.add(loggerInfo.id, {
        levels: this.logLevels,
        transports: currentTransports,
        format: winston.format.combine(
          winston.format.colorize({
            colors: this.logColors
          }),
          winston.format.label({ label: loggerInfo.label }),
          winston.format.timestamp(),
          this.logFormat
        )
      })
    })
    this.debug('All loggers created!')
  }

  /**
   * Gets the specified logger.
   * @param {string} loggerId The logger ID.
   * @returns {winston.Logger}
   */
  get (loggerId) {
    // Literately just a proxy method.
    return this.loggers.get(loggerId)
  }

  /**
   * Returns all the loggers that this class has.
   * @returns {Array<winston.Logger>}
   */
  allLoggers () {
    const loggers = []
    this.loggerIDs.forEach(id => {
      loggers.push(this.get(id))
    })
    return loggers.filter(logger => typeof logger !== 'undefined' && logger !== null)
  }
}

module.exports = exports = Loggers
