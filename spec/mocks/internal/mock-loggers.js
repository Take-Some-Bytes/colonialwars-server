/**
 * @fileoverview Mock Loggers class.
 */

import events from 'events'

import winston from 'winston'

/**
 * @typedef {Object<string, (...data: any[]) => void>} Logger
 */

/**
 * Mock loggers.
 *
 * Emits a 'log' event whenever something is logged.
 */
export default class MockLoggers extends events.EventEmitter {
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
    Object.keys(winston.config.syslog.levels).forEach(level => {
      logger[level] = this.log.bind(this)
    })
    return logger
  }
}
