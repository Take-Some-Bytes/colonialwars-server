/**
 * @fileoverview Mock Loggers class.
 */

const winstonConfig = require('winston/lib/winston/config')

/**
 * @typedef {Object<string, (...data: any[]) => void>} Logger
 */

/**
 * Again, just prints everything to console.
 */
class MockLoggers {
  constructor () {
    this.log = function (...args) { /** Swallow */ }
  }

  /**
   * Just returns a logger with console.log
   * @returns {Logger}
   */
  get () {
    const logger = {}
    Object.keys(winstonConfig.syslog.levels).forEach(level => {
      logger[level] = this.log
    })
    return logger
  }
}

module.exports = exports = MockLoggers
