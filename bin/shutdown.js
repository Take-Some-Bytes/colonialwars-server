/**
 * @fileoverview Functions to handle the shutdown of this process.
 */

/**
 * A variable which contains a timeout that forcefully shuts
 * down this process.
 */
let exitTimeout = null

/**
 * Gracefully shuts down a CWServer instance.
 * @param {InstanceType<import('../')>} server The CWServer instance.
 * @param {NodeJS.Signals} signal The signal that was received.
 */
async function handleShutdown (server, signal) {
  // You have ten seconds.
  !exitTimeout && (exitTimeout = setTimeout(process.exit, 10 * 1000, 1).unref())

  server.loggers.get('Server-logger').info(
    `Signal ${signal} received. Shutting down server...`
  )
  try {
    const serverStopped = await server.stop()
    if (!serverStopped) {
      server.loggers.get('Server-logger').warning(
        'Server is already in CLOSED or CLOSING state.'
      )
    } else {
      server.loggers.get('Server-logger').info(
        'Server shutdown successfully. Exiting...'
      )
      process.exitCode = 0
    }
  } catch (ex) {
    server.loggers.get('Server-logger').crit(
      `An error occured while shutting down server. Error is: ${ex.stack}`
    )
    process.exitCode = 1
  }
}

/**
 * Handles an uncaught exception in the process.
 * @param {InstanceType<import('../')>} server The CWServer instance.
 * @param {Error} ex The error that happened.
 */
async function handleUncaughtEx (server, ex) {
  // You have ten seconds.
  !exitTimeout && (exitTimeout = setTimeout(process.exit, 10 * 1000, 1).unref())

  try {
    server.loggers.get('Server-logger').crit(
      `Server crashed. Error is: ${ex.stack}`
    )
    server.loggers.get('Server-logger').crit(
      'Exiting...'
    )
    await server.stop()
    process.exitCode = 1
  } catch (err) {
    server.loggers.get('Server-logger').crit(
      `Graceful shutdown failed with error ${err.stack}`
    )
    server.loggers.get('Server-logger').crit(
      'Forcing shutdown in one second...'
    )
    // Forcefully exit after one second.
    setTimeout(() => {
      process.exit(1)
    }, 1000)
  }
}

module.exports = exports = {
  handleShutdown,
  handleUncaughtEx
}
