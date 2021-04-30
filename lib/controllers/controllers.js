/* eslint-env node */
/**
 * @fileoverview Controllers class for controlling the handling of routes.
 */

const util = require('util')
const crypto = require('crypto')
const Router = require('router')
const debug = require('debug')('colonialwars:controllers')

const Manager = require('../game/manager')
const randomBytes = util.promisify(crypto.randomBytes)

/**
 * @typedef {InstanceType<import('../game/manager')>} ManagerInstance
 *
 * @typedef {Object} ControllersConfig
 * @prop {boolean} isProd
 * @prop {IStringDB} authDB
 * @prop {string} gameAuthSecret
 * @prop {InstanceType<import('../utils/server-utils')>} serverUtils
 *
 * @typedef {Object} CapacityStats
 * @prop {number} maxClients
 * @prop {number} currentClients
 *
 * @typedef {Object} CWServerStatus
 * @prop {boolean} running
 * @prop {boolean} full
 * @prop {CapacityStats} capacity
 *
 * @typedef {Object} StatusReporter
 * @prop {() => CWServerStatus} getStatus
 *
 * @typedef {Object} IStringDB
 * @prop {(key: string) => Promise<string>} get
 * @prop {(key: string) => Promise<boolean>} del
 * @prop {(key: string) => Promise<boolean>} has
 * @prop {(key: string, val: string) => Promise<void>} set
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
      authDB,
      serverUtils,
      gameAuthSecret
    } = config

    this.isProd = isProd
    this.authDB = authDB
    this.serverUtils = serverUtils
    this.gameAuthSecret = gameAuthSecret
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
        debug('Headers: %O', req.headers)
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/plain')
        // XXX: This route doesn't conform to the message structures that are
        // defined. It's not supposed to.
        res.end('200 OK')
      })
    return router
  }

  /**
   * Registers a status report route at ``/status-report``.
   * @param {InstanceType<import('router')>} router The Router to register the testing route on.
   * @param {StatusReporter} statusReporter The object to get the current CWServer status from.
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
        const resData = JSON.stringify({
          status: 'ok',
          data: {
            serverRunning: status.running,
            full: status.full,
            maxClients: status.capacity.maxClients,
            currentClients: status.capacity.currentClients
          }
        })
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Content-Length', Buffer.byteLength(resData))
        res.write(resData)
        res.end()
      })
    return router
  }

  /**
   * Registers a route to give the client statistics about the running games on this game server.
   * @param {InstanceType<import('router')>} router The Router to register the stats route on.
   * @param {InstanceType<import('../game/manager')} manager The Game manager to get the statistics
   * about the running games from.
   * @returns {InstanceType<import('router')>}
   */
  registerGamesStatsRoute (router, manager) {
    if (!(manager instanceof Manager)) {
      throw new TypeError(
        'Manager parameter is not an instance of the Manager class!'
      )
    }

    router.route('/games-stats')
      .get((req, res) => {
        const availableGames = manager.availableGames
        const arrLen = availableGames.length
        const dataToSend = []

        for (let i = 0; i < arrLen; i++) {
          const game = availableGames[i]
          dataToSend.push({
            id: game.id,
            mode: game.mode,
            name: game.name,
            teams: game.availableTeams,
            description: game.description,
            capacity: {
              max: game.maxPlayers,
              current: game.currentPlayers
            }
          })
        }

        const resData = JSON.stringify({
          status: 'ok',
          data: dataToSend
        })

        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Content-Length', Buffer.byteLength(resData))
        res.write(resData)
        res.end()
      })
  }

  /**
   * Returns a router for game authorization.
   * @returns {InstanceType<Router>}
   */
  gameAuthRouter () {
    const router = Router()

    router.route('/get').get(async (req, res) => {
      const reqIP = req.ip || 'Unknown IP'
      const db = this.authDB

      if (!req.query || !(req.query instanceof URLSearchParams)) {
        debug('Game authorization requested without query!')
        this.serverUtils.sendError({
          httpOpts: {
            status: 400,
            contentType: 'application/json'
          },
          logOpts: {
            doLog: true,
            loggerID: 'Server-logger',
            logLevel: 'error',
            logMessage:
              `${reqIP} tried to GET /game-auth/get without a query.`
          },
          message: JSON.stringify({
            status: 'error',
            error: {
              message: 'Querystring is required!'
            }
          })
        })(req, res)
        return
      }
      /**
       * @type {URLSearchParams}
       */
      const query = req.query
      const data = {
        playerName: query.get('playername'),
        playerTeam: query.get('playerteam'),
        playerGame: query.get('playergame')
      }

      if (await db.has(data.playerName)) {
        this.serverUtils.sendError({
          httpOpts: {
            status: 409,
            contentType: 'application/json'
          },
          logOpts: {
            doLog: true,
            loggerID: 'Server-logger',
            logLevel: 'error',
            logMessage:
              `${reqIP} requested authorization credentials for a player that is` +
              ' already pending authorization.'
          },
          message: JSON.stringify({
            status: 'error',
            error: {
              message: 'Player already exists.'
            }
          })
        })(req, res)
        return
      } else if (!Object.values(data).every(val => !!val)) {
        this.serverUtils.sendError({
          httpOpts: {
            status: 400,
            contentType: 'application/json'
          },
          logOpts: {
            doLog: true,
            loggerID: 'Server-logger',
            logLevel: 'error',
            logMessage:
              `${reqIP} didn't supply all required fields in query.`
          },
          message: JSON.stringify({
            status: 'error',
            error: {
              message: 'Querystring missing fields!'
            }
          })
        })(req, res)
        return
      }
      // Add something random to the HMAC, so that an attacker couldn't just
      // make a request to this endpoint and get the exact same credentials
      // as a legitimate client.
      const random = (await randomBytes(16)).toString('hex')
      const hmac = crypto.createHmac('sha256', this.gameAuthSecret)
        .update(JSON.stringify(data))
        .update('.')
        .update(random)
        .digest()
        .toString('hex')
      const json = JSON.stringify({
        status: 'ok',
        data: {
          auth: hmac
        }
      })

      await db.set(data.playerName, JSON.stringify({
        auth: hmac,
        name: data.playerName,
        team: data.playerTeam,
        game: data.playerGame
      }))

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Length', Buffer.byteLength(json))
      res.write(json)
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
          status: 404,
          contentType: 'application/json'
        },
        logOpts: {
          doLog: true,
          loggerID: 'Server-logger',
          logLevel: 'error',
          logMessage:
            `${reqIP} tried to ${req.method} route ${req.url}, which was not handled.`
        },
        message: JSON.stringify({
          status: 'error',
          error: {
            message: '404 Resource Not Found.'
          }
        })
      })(req, res)
    })
    return router
  }
}

module.exports = exports = Controllers
