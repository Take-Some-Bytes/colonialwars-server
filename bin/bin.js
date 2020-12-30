/* eslint-env node */
/**
 * @fileoverview Executable file for the Colonial Wars backend.
 */

const GameServer = require('../')
const shutdown = require('./shutdown')

process.title = `cw-server-${process.env.INSTANCE_NUM}`

;(async () => {
  const server = await GameServer.create(process.argv[2])
  server.start()

  process.on('SIGINT', shutdown.handleShutdown.bind(null, server))
  process.on('SIGTERM', shutdown.handleShutdown.bind(null, server))

  process.on('uncaughtException', shutdown.handleUncaughtEx.bind(null, server))
  process.on('unhandledRejection', shutdown.handleUncaughtEx.bind(null, server))
})()
