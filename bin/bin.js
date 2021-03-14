/* eslint-env node */
/**
 * @fileoverview Executable file for the Colonial Wars backend.
 */

const GameServer = require('../')
const shutdown = require('./shutdown')

process.title = `cw-server-${process.env.INSTANCE_NUM}`

;(async () => {
  const server = await GameServer.create(process.argv[2])
  const serverLogger = server.loggers.get('Server-logger')

  server.start().then(serverStarted => {
    if (!serverStarted) {
      serverLogger.warning('Server is already in STARTING or STARTED state!')
    } else {
      serverLogger.info(
        `Server started at http://${server.config.get('HOST')}:${server.config.get('PORT')}.`
      )
    }
  }).catch(err => {
    if (err.code === 'ENOTINITIALIZED') {
      serverLogger.alert('Server did not initialize before starting!')
      serverLogger.alert('There is likely a fatal bug in the code.')
    } else {
      serverLogger.crit('Error while starting server! Error is:')
      serverLogger.crit(err.stack)
    }
  })

  process.on('SIGINT', shutdown.handleShutdown.bind(null, server))
  process.on('SIGTERM', shutdown.handleShutdown.bind(null, server))

  process.on('uncaughtException', shutdown.handleUncaughtEx.bind(null, server))
  process.on('unhandledRejection', shutdown.handleUncaughtEx.bind(null, server))
})()
