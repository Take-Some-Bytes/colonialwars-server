/* eslint-env node */
/**
 * @fileoverview Controllers class for controlling the handling of routes.
 */

const util = require('util')
const crypto = require('crypto')
// const debug = require('debug')('colonialwars:controllers')

const { ErrorSender } = require('../utils/server-utils')
const randomBytes = util.promisify(crypto.randomBytes)

/**
 * @typedef {InstanceType<import('../game/manager')>} ManagerInstance
 *
 * @typedef {Object} ControllersConfig
 * @prop {IStringDB} authDB
 * @prop {import('../logging/loggers')} loggers
 * @prop {string} gameAuthSecret
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
 *
 * @callback RouteHandler
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @returns {void}
 *
 * @callback AsyncRouteHandler
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @returns {Promise<void>}
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
      authDB,
      loggers,
      gameAuthSecret
    } = config

    this.authDB = authDB
    this.loggers = loggers
    this.gameAuthSecret = gameAuthSecret
  }

  /**
   * Returns a function which handles requests for ``/status-report``.
   * @param {StatusReporter} reporter The object to get the current server
   * status from.
   * @returns {RouteHandler}
   */
  statusReport (reporter) {
    if (!reporter || typeof reporter.getStatus !== 'function') {
      throw new TypeError('The reporter parameter must have a getStatus function')
    }

    return function statusReport (_, res) {
      const status = reporter.getStatus()
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
    }
  }

  /**
   * Returns a handler for the ``/game-info`` route.
   * @param {InstanceType<import('../game/manager')>} manager The Game manager to
   * obtain game information from.
   * @returns {RouteHandler}
   */
  gamesInfo (manager) {
    return function gamesInfo (_, res) {
      const resData = JSON.stringify({
        status: 'ok',
        data: manager.games.map(game => {
          const info = game.getInfo()

          return {
            id: info.id,
            mode: info.mode,
            name: info.name,
            description: info.description,
            teams: game.getTeams(),
            capacity: {
              max: game.maxPlayers,
              current: game.currentPlayers
            }
          }
        })
      })

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Length', Buffer.byteLength(resData))
      res.write(resData)
      res.end()
    }
  }

  /**
   * Returns a handler to hand out game authorization to clients.
   * @param {InstanceType<import('../game/manager')>} manager The games manager.
   * @returns {AsyncRouteHandler}
   */
  gameAuth (manager) {
    const self = this

    return async function gameAuth (req, res) {
      const reqID = req.id || 'unknown'
      const db = self.authDB
      const errSender = new ErrorSender({ response: res })
      const serverLogger = self.loggers.get('Server-logger')

      if (!req.query || !(req.query instanceof URLSearchParams)) {
        const logMsg = [
          `Request [${reqID}]: requested game auth without query.`
        ].join('')

        errSender.sendErrorAndLog(
          'Query string is required!', serverLogger,
          { logMsg, status: 400 }
        )
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

      if (!Object.values(data).every(val => !!val)) {
        const logMsg = [
          `Request [${reqID}]: missing fields in query for`,
          ' /game-auth/get.'
        ].join('')

        errSender.sendErrorAndLog(
          'Query string missing fields.', serverLogger,
          { logMsg, status: 400 }
        )
        return
      }
      if (await db.has(data.playerName) || manager.playerExists(data.playerName)) {
        const logMsg = [
          `Request [${reqID}]: requested authorization for ${data.playerName}`,
          ', who had already requested authorization.'
        ].join('')

        errSender.sendErrorAndLog(
          'Player already exists.', serverLogger,
          { logMsg, status: 409 }
        )
        return
      }

      const game = manager.getGame(`game-${data.playerGame}`)
      if (!game) {
        const logMsg = [
          `Request [${reqID}]: tried to join non-existent game `,
          `with ID: "game-${data.playerGame}"`
        ].join('')

        errSender.sendErrorAndLog(
          'Game not found', serverLogger,
          { logMsg, status: 400 }
        )
        return
      }
      if (game.currentPlayers === game.maxPlayers) {
        const logMsg = [
          `Request [${reqID}]: tried to join game "game-${data.playerGame}"`,
          ', which was full'
        ].join('')

        errSender.sendErrorAndLog(
          'Game is full', serverLogger,
          { logMsg, status: 400 }
        )
        return
      }
      if (!game.hasTeam(data.playerTeam)) {
        const logMsg = [
          `Request [${reqID}]: tried to join game "game-${data.playerGame}" `,
          `with non-existent team ${data.playerTeam}`
        ].join('')

        errSender.sendErrorAndLog(
          'Team not found', serverLogger,
          { logMsg, status: 400 }
        )
        return
      }
      if (game.teamFull(data.playerTeam)) {
        const logMsg = [
          `Request [${reqID}]: tried to join game "game-${data.playerGame}" `,
          `on team ${data.playerTeam}, which was full`
        ].join('')

        errSender.sendErrorAndLog(
          'Team is full', serverLogger,
          { logMsg, status: 400 }
        )
        return
      }

      /**
       * CONSIDER: Doing crypto stuff in the libuv threadpool?
       * (04/23/2022) Take-Some-Bytes */
      const random = (await randomBytes(16)).toString('hex')
      const hmac = crypto.createHmac('sha256', self.gameAuthSecret)
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
    }
  }

  /**
   * Returns a handler that sends a 404 every time it's called.
   * @returns {RouteHandler}
   */
  unhandled () {
    const self = this

    return function unhandled (req, res) {
      const reqID = req.id || 'unknown'
      const logMsg = [
        `Request [${reqID}]: resource at ${req.url} not found.`
      ].join('')
      const serverLogger = self.loggers.get('Server-logger')

      new ErrorSender({ response: res })
        .sendErrorAndLog(
          '404 Not Found', serverLogger,
          { logMsg, status: 404 }
        )
    }
  }
}

module.exports = Controllers
