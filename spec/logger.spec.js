/* eslint-env jasmine */
/**
 * @fileoverview Tests for Logger class.
 */

const winston = require('winston')
const Loggers = require('../lib/logging/loggers')
const MockSyslogServer = require('./mocks/external/mock-syslog-server')

/**
 * Promise delay.
 * @param {number} time The time to delay for.
 */
const delay = (time) => new Promise(resolve => setTimeout(resolve, time))

describe('The Loggers class, when used without a Syslog server,', () => {
  const oldProcessTitle = process.title
  let loggers = null
  let err = null

  beforeAll(() => {
    // Make sure process.title is `testing_logger`.
    process.title = 'testing_logger'
  })
  afterAll(() => {
    // Reset process title.
    process.title = oldProcessTitle
  })

  it('should construct without error', () => {
    try {
      console.log()
      loggers = new Loggers({
        isProd: false,
        debug: (...args) => {
          console.log(`DEBUG: ${args.join(' ')}`)
        },
        loggerInfos: [
          {
            id: 'Server-logger',
            label: 'Server_log'
          },
          {
            id: 'Security-logger',
            label: 'Security_log'
          }
        ],
        // Use syslog config.
        levels: winston.config.syslog.levels,
        colors: winston.config.syslog.colors
      })
    } catch (ex) {
      err = ex
    }

    expect(err).toBe(null)
    expect(loggers).toBeInstanceOf(Loggers)
  })

  it('should have two loggers', () => {
    let numLoggers = 0
    if (loggers instanceof Loggers) {
      numLoggers = loggers.allLoggers().length
    }
    expect(numLoggers).toBe(2)
  })

  it('should be able to log (with colour)', () => {
    let logged = 0
    if (loggers instanceof Loggers) {
      loggers.allLoggers().forEach(logger => {
        console.log()
        logger.debug('DEBUG level')
        logger.info('INFO level')
        logger.notice('NOTICE level')
        logger.warning('WARNING level')
        logger.error('ERROR level')
        logger.crit('CRITICAL level')
        logger.alert('ALERT level')
        logger.emerg('EMERGENCY level')
        logged++
      })
    }
    expect(logged).toBeGreaterThanOrEqual(1)
  })
})

describe('The Loggers class, when used with a mock Syslog server,', () => {
  const syslogServer = new MockSyslogServer()
  let loggers = null
  let err = null

  // First, start the mock Syslog server.
  beforeAll(async () => {
    await syslogServer.start()
  })
  // Clean up the server once done.
  afterAll(async () => {
    await syslogServer.stop()
  })

  it('should construct without error', () => {
    console.log()
    try {
      loggers = new Loggers({
        isProd: true,
        debug: console.log,
        loggerInfos: [
          {
            id: 'Server-logger',
            label: 'Server_log'
          },
          {
            id: 'Security-logger',
            label: 'Security_log'
          }
        ],
        // Use syslog config
        levels: winston.config.syslog.levels,
        colors: winston.config.syslog.colors,
        syslogOpts: {
          port: 5514,
          host: 'localhost',
          protocol: 'tcp4',
          type: 'rfc5424',
          eol: '\r\n'
        }
      })
    } catch (ex) {
      err = ex
    }

    expect(err).toBe(null)
    expect(loggers).toBeInstanceOf(Loggers)
  })

  it('should be able to send logs to syslog server', async () => {
    let dataReceived = false
    console.log()
    if (loggers instanceof Loggers) {
      loggers.allLoggers().forEach(logger => {
        logger.alert('If you don\'t log this you don\'t work.')
      })
    }
    await delay(1000)
    dataReceived = syslogServer.dataReceived
    expect(dataReceived).toBe(true)
  })
})
