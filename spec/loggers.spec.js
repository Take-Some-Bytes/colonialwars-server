/* eslint-env jasmine */
/**
 * @fileoverview Tests for Loggers class.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const fs = require('fs')
const winston = require('winston')
const Loggers = require('../lib/logging/loggers')
const MockSyslogServer = require('./mocks/external/mock-syslog-server')

/**
 * Promise delay.
 * @param {number} time The time to delay for.
 */
const delay = (time) => new Promise(resolve => setTimeout(resolve, time))
const nullWriteStream = fs.createWriteStream('/dev/null', { encoding: 'utf8' })

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
        colourize: true,
        colours: winston.config.syslog.colors,
        loggingLevels: winston.config.syslog.levels
      })
    } catch (ex) {
      err = ex
    }

    expect(err).toBe(null)
    expect(loggers).toBeInstanceOf(Loggers)
  })

  it('should be able to create as many loggers as we want', () => {
    if (loggers instanceof Loggers) {
      loggers.addLogger({
        id: 'test-logger-1',
        label: 'Test Logger 1',
        useReadableFormat: true,
        transports: [{ type: 'stream', config: { stream: nullWriteStream } }]
      })
    }

    expect(loggers.allLoggers().length).toBe(1)
  })

  it('should be able to log (with colour)', () => {
    let logged = 0
    if (loggers instanceof Loggers) {
      spyOn(nullWriteStream, 'write').and.callThrough()
      loggers.allLoggers().forEach(logger => {
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
    expect(nullWriteStream.write).toHaveBeenCalled()
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
        // Use syslog config
        loggingLevels: winston.config.syslog.levels,
        colours: winston.config.syslog.colors,
        colourize: true
      })
      loggers.addLogger({
        id: 'syslog-transport-logger',
        label: 'Syslog Transport Log',
        transports: [{
          type: 'syslog',
          config: {
            port: 5514,
            host: 'localhost',
            protocol: 'tcp4',
            type: 'rfc5424'
          }
        }],
        useReadableFormat: true
      })
    } catch (ex) {
      err = ex
    }

    expect(err).toBe(null)
    expect(loggers).toBeInstanceOf(Loggers)
  })

  it('should be able to send logs to syslog server', async () => {
    let dataReceived = false
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
