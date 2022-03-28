/**
 * @fileoverview Mock Loggers class.
 */

const events = require('events')

const winstonConfig = require('winston/lib/winston/config')

/**
 * @typedef {Object<string, (...data: any[]) => void>} Logger
 */

/**
 * Mock loggers.
 *
 * Emits a 'log' event whenever something is logged.
 */
class MockLoggers extends events.EventEmitter {
  constructor () {
    super()

    this.log = function (...args) {
      this.emit('log', ...args)
    }
  }

  /**
   * Just returns a logger with console.log
   * @returns {Logger}
   */
  get () {
    const logger = {}
    Object.keys(winstonConfig.syslog.levels).forEach(level => {
      logger[level] = this.log.bind(this)
    })
    return logger
  }
}

module.exports = exports = MockLoggers
