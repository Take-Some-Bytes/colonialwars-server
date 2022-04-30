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
    if (!Array.isArray(manager.availableGames)) {
      throw new TypeError('Manager parameter must be instance of the Manager class')
    }

    return function gamesInfo (_, res) {
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
    }
  }

  /**
   * Returns a handler to hand out game authorization to clients.
   * @returns {AsyncRouteHandler}
   */
  gameAuth () {
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
          { logMsg: logMsg, status: 400 }
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

      if (await db.has(data.playerName)) {
        const logMsg = [
          `Request [${reqID}]: requested authorization for ${data.playerName}`,
          ', who had already requested authorization.'
        ].join('')

        errSender.sendErrorAndLog(
          'Player already exists.', serverLogger,
          { logMsg: logMsg, status: 409 }
        )
        return
      } else if (!Object.values(data).every(val => !!val)) {
        const logMsg = [
          `Request [${reqID}]: missing fields in query for`,
          ' /game-auth/get.'
        ].join('')

        errSender.sendErrorAndLog(
          'Query string missing fields.', serverLogger,
          { logMsg: logMsg, status: 400 }
        )
        return
      }
      // Add something random to the HMAC, so that an attacker couldn't just
      // make a request to this endpoint and get the exact same credentials
      // as a legitimate client.
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
          { logMsg: logMsg, status: 404 }
        )
    }
  }
}

module.exports = Controllers
