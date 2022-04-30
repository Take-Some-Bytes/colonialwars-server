/* eslint-env node */
/**
 * @fileoverview Loggers class.
 */

const debug = require('debug')('colonialwars:loggers')
const winston = require('winston')
const winstonSyslog = require('winston-syslog')

const Syslog = winstonSyslog.Syslog

const processTitle = winston.format(info => {
  info.procTitle = process.title
  return info
})

/**
 * @typedef {'console'|'file'|'syslog'|'http'|'stream'} TransportType
 *
 * @typedef {Object} LoggingConfig
 * @prop {import('winston').config.AbstractConfigSetLevels} loggingLevels
 * @prop {import('winston').Logform.ColorizeOptions} [colours]
 * @prop {boolean} [colourize] Whether to colourize the logging output. If true, only
 * the level will be colourized.
 *
 * @typedef {Object} LoggerConfig
 * @prop {string} id
 * @prop {string} label
 * @prop {Array<TransportConfig>} transports
 * @prop {boolean} useReadableFormat Whether to log in a human-readable format.
 *
 * @typedef {Object} TransportConfig
 * @prop {TransportType} type
 * @prop {import('winston-transport').TransportStreamOptions} config
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
    this.levels = config.loggingLevels
    this.colours = config.colours || null
    this.colourize = config.colourize || false

    if (this.colours) {
      winston.addColors(this.colours)
    }

    this.loggers = new winston.Container()

    /**
     * Return the default logging format for a logger of this class.
     * @param {string} label Logger label.
     * @returns {import('winston').Logform.Format}
     */
    this.defaultFormat = (label) => {
      return winston.format.combine(
        winston.format.colorize({ colors: this.colours, level: true }),
        winston.format.label({ label }),
        winston.format.timestamp(),
        winston.format.splat(),
        processTitle(),
        winston.format.json()
      )
    }

    /**
     * Return a readable logging format for a logger of this class.
     * @param {string} label Logger label.
     * @returns {import('winston').Logform.Format}
     */
    this.readableFormat = (label) => {
      return winston.format.combine(
        winston.format.colorize({ colors: this.colours, level: true }),
        winston.format.label({ label }),
        winston.format.timestamp(),
        winston.format.splat(),
        processTitle(),
        winston.format.printf(info => [
          `${info.procTitle}: ${info.timestamp} `,
          `[${info.label}] ${info.level}: ${info.message}`
        ].join(''))
      )
    }
  }

  /**
   * Adds a new logger.
   * @param {LoggerConfig} conf Logger configurations.
   */
  addLogger (conf) {
    debug(
      'Creating new logger %s with %d transport(s)', conf.label, conf.transports.length
    )
    if (!conf.transports ||
        !Array.isArray(conf.transports) ||
        conf.transports.length < 1) {
      throw new TypeError('All loggers must have at least one transport!')
    }

    let loggerFormat
    if (conf.useReadableFormat) {
      loggerFormat = this.readableFormat(conf.label)
    } else {
      loggerFormat = this.defaultFormat(conf.label)
    }

    this.loggers.add(conf.id, {
      levels: this.levels,
      transports: conf.transports.map(transportConf => {
        const Transport = getTransport(transportConf.type)
        return new Transport(transportConf.config)
      }),
      format: loggerFormat
    })
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
    return Array.from(this.loggers.loggers.values())
  }
}

module.exports = Loggers

/**
 * Returns the transport object that is associated with the given type.
 * @param {TransportType} type The string name for the transport.
 * @returns {typeof import('winston-transport')}
 */
function getTransport (type) {
  switch (type) {
    case 'console': return winston.transports.Console
    case 'file': return winston.transports.File
    case 'stream': return winston.transports.Stream
    case 'http': return winston.transports.Http
    case 'syslog': return Syslog
    default: throw new TypeError('Unrecognized transport type!')
  }
}
