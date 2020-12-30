/* eslint-env node */
/**
 * @fileoverview Controllers class for controlling the handling of routes.
 */

/**
 * @typedef {Object} ControllersConfig
 * @prop {boolean} isProd
 * @prop {InstanceType<import('../utils/server-utils')>} serverUtils
 *
 * @typedef {Object} CapacityStats
 * @prop {number} maxClients
 * @prop {number} currentClients
 *
 * @typedef {Object} GameServerStatus
 * @prop {boolean} running
 * @prop {boolean} full
 * @prop {CapacityStats} capacity
 *
 * @typedef {Object} StatusReporter
 * @prop {() => GameServerStatus} getStatus
 */

/**
 * Controllers class.
 */
class Controllers {
  /**
   * Constructor for a Controllers class.
   * @param {ControllersConfig} config Configurations.
   */
  constructor (config) {
    const {
      isProd,
      serverUtils
    } = config

    this.isProd = isProd
    this.serverUtils = serverUtils
  }

  /**
   * Registers a testing route at ``/testing``. Will not work if
   * ``controllers.isProd`` is set to true.
   * @param {InstanceType<import('router')>} router The Router to register the testing route on.
   * @returns {InstanceType<import('router')>}
   */
  registerTestRoute (router) {
    if (this.isProd) {
      return router
    }

    router.route('/testing')
      .get((req, res) => {
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/plain')
        res.end('200 OK')
      })
    return router
  }

  /**
   * Registers a status report route at ``/status-report``.
   * @param {InstanceType<import('router')>} router The Router to register the testing route on.
   * @param {StatusReporter} statusReporter The object to get the current GameServer status from.
   * @returns {InstanceType<import('router')>}
   */
  registerStatusRoute (router, statusReporter) {
    if (
      !statusReporter ||
      typeof statusReporter.getStatus !== 'function'
    ) {
      throw new TypeError(
        'The statusReporter parameter is required, and it must have a getStatus method!'
      )
    }

    router.route('/status-report')
      .get((req, res) => {
        const status = statusReporter.getStatus()
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.write(JSON.stringify({
          serverRunning: status.running,
          full: status.full,
          maxClients: status.capacity.maxClients,
          currentClients: status.capacity.currentClients
        }))
        res.end()
      })
    return router
  }

  /**
   * Handles all unhandled routes.
   * @param {InstanceType<import('router')>} router The Router.
   * @returns {InstanceType<import('router')>}
   */
  handleUnhandled (router) {
    router.route('*').all((req, res) => {
      const reqIP = req.ip || 'Unknown IP.'
      this.serverUtils.sendError({
        httpOpts: {
          status: 404
        },
        logOpts: {
          doLog: true,
          loggerID: 'Server-logger',
          logLevel: 'error',
          logMessage:
            `${reqIP} tried to ${req.method} route ${req.url}, which was not handled.`
        },
        message: '404 Route not found.'
      })(req, res)
    })
    return router
  }
}

module.exports = exports = Controllers
