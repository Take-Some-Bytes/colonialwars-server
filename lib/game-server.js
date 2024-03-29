/* eslint-env node */
/**
 * @fileoverview GameServer class to run the backend Colonial Wars games.
 */

import { strict as assert } from 'assert'
import debugFactory from 'debug'

import * as cwdtp from './cwdtp/index.js'
import constants from './constants.js'

const debug = debugFactory('colonialwars:gameserver')
const { COMMUNICATIONS: communications } = constants

/**
 * @typedef {Record<'auth'|'name'|'team'|'game', string>} AuthEntry
 *
 * @typedef {Object} GameServerOptions
 * @prop {InstanceType<typeof import('./utils/server-config')>} config
 * @prop {import('http').Server} server The HTTP server to attach to.
 * @prop {import('winston').Logger} gamelogger The logger to use.
 * @prop {import('./timed-store')} authStore
 * @prop {InstanceType<import('./game/manager')>} manager
 * @prop {InstanceType<import('./controllers/middlewares')>} middlewares
 */

/**
 * GameServer class.
 */
export default class GameServer {
  /**
   * Constructor for a GameServer class.
   * @param {GameServerOptions} opts Options.
   */
  constructor (opts) {
    const {
      server, config, manager, middlewares,
      gamelogger, authStore
    } = opts

    this.server = server
    this.config = config
    this.manager = manager
    this.authStore = authStore
    this.gamelogger = gamelogger
    this.middlewares = middlewares
  }

  /**
   * Private handler to get a client's IP.
   * @param {import('http').IncomingMessage} req
   * @private
   */
  _getClientIP (req) {
    this.middlewares.forwardedParser()(req, null, () => {})
    this.middlewares.getClientIP({
      behindProxy: this.config.IS_PROD,
      trustedIPs: this.config.TRUSTED_IPS
    })(req, null, () => {})

    if (!req.ip) {
      return 'Unknown IP.'
    }
    return req.ip
  }

  /**
   * Makes sure a client has authorization before allowing them on the
   * game server.
   * @param {import('http').IncomingMessage} req
   * @param {import('./cwdtp/server').ErrorCallback} cb
   * @private
   */
  _verifyClient (req, cb) {
    // XXX: We don't care about the host, hostname and whatnot.
    // Take-Some-Bytes
    const url = new URL(req.url, 'http://localhost:4000')
    const query = url.searchParams
    if (!query || !(query instanceof URLSearchParams)) {
      return cb(makeError('Query is missing!', 'EMISSING', 400))
    }

    const data = {
      auth: query.get('auth'),
      game: query.get('game'),
      name: query.get('playername'),
      team: query.get('playerteam')
    }
    if (!Object.values(data).every(val => !!val)) {
      debug('Query is missing fields!')
      return cb(makeError('Query does not have all required fields!', 'EMISSINGFIELDS', 400))
    }

    const authEntry = this.authStore.get(data.name)
    if (!authEntry) {
      debug('Player is not authorized')
      return cb(makeError('Player is not authorized!', 'ENOTAUTH', 401))
    }

    /**
     * @type {AuthEntry}
     */
    const parsed = JSON.parse(authEntry)
    if (data.auth !== parsed.auth) {
      debug('Authorization tokens do not match.')
      return cb(makeError(
        'Authorization token does not match!',
        'ENOTAUTH', 401
      ))
    }

    try {
      // Assert that all requested parameters and stored parameters are the same.
      assert.deepStrictEqual(data, parsed)
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        // Invalid authorization token should have already been caught
        // by the previous if clause, so just send a 400.
        debug('Invalid auth, or player fields did not match!')
        return cb(makeError(
          'Invalid auth, or player fields did not match!',
          'ENOMATCH',
          400
        ))
      } else {
        // Something else happened.
        debug('Error: %O', err)
        return cb(makeError(
          'Failed', 'EFAILED', 500
        ))
      }
    }

    // I think we're good?
    cb(null)
  }

  /**
   * Handler for the "connection" event.
   * @param {import('colonialwars-lib/cwdtp').WSConn<string>} conn The WSConn object.
   * @param {import('http').IncomingMessage} req The request that initiated the
   * WSConn connection.
   */
  _onConnection (conn, req) {
    // We expect that the _verifyClient function up above had already
    // validated the WebSocket's query fields, so no validation here.
    const url = new URL(req.url, 'http://localhost:4000')
    const query = url.searchParams
    const data = {
      game: query.get('game'),
      name: query.get('playername'),
      team: query.get('playerteam')
    }

    const gameID = `game-${data.game}`
    const game = this.manager.getGame(gameID)
    // Give the client ten seconds to get ready.
    const readyTimeout = setTimeout(() => {
      this.gamelogger.notice(
        `Client ${conn.id} did not send a CONN_READY event within 10s of connecting.`
      )
      conn.terminate(4004, 'Timeout')
    }, 10000)
    debug('Connection received')
    this.gamelogger.info(`Client ${conn.id} connected.`)

    conn.messages.on(communications.CONN_READY, () => {
      clearTimeout(readyTimeout)
      game.addPlayer(conn, {
        name: data.name,
        team: data.team
      })

      conn.send(communications.CONN_READY_ACK, game.getMapData())

      debug('Client %s accepted into game %s', conn.id, gameID)
    })

    conn.messages.on(communications.CONN_CLIENT_ACTION, input => {
      try {
        game.addInputTo(conn.id, input)
      } catch (ex) {
        // Something's wrong with this connection.
        // Terminate it.
        game.removePlayer(conn)
        conn.terminate(1008, 'Something went wrong and it should not have')
      }
    })

    conn.on('close', () => {
      game.removePlayer(conn)
      debug('Client %s disconnected from game %s', conn.id, gameID)
    })
  }

  /**
   * Initializes this GameServer.
   */
  init () {
    /**
     * @type {import('ws').PerMessageDeflateOptions|false}
     */
    let perMessageDeflate = false

    if (this.config.IS_PROD) {
      /**
       * TODO: Go over these configurations again.
       * Let's see what we have missed.
       * (04/27/2021) Take-Some-Bytes */
      perMessageDeflate = {
        clientMaxWindowBits: 11,
        serverMaxWindowBits: 11,
        serverNoContextTakeover: false,
        clientNoContextTakeover: false,
        zlibDeflateOptions: {
          memLevel: 6
        }
      }
    }

    this.wsServer = new cwdtp.WSServer({
      getClientIP: this._getClientIP.bind(this),
      verifyClient: this._verifyClient.bind(this),
      handleCors: (origin) => {
        return this.config.ALLOWED_ORIGINS.includes(origin)
      },
      perMessageDeflate,
      heartBeatInterval: 20 * 1000,
      maxConnsPerIP: 150,
      path: '/play'
    })

    this.wsServer.attach(this.server)
    this.wsServer.on('connection', this._onConnection.bind(this))
  }

  /**
   * Stops this game server.
   */
  stop () {
    this.wsServer.detach(this.server)
  }
}

/**
 * Makes and returns an error with the specified message and the
 * specified error code.
 * @param {string} msg The error message.
 * @param {string} code An error code for the error.
 * @param {number} [statusCode] An optional HTTP status code.
 * @returns {Error & { code: string; status?: number; }}
 */
function makeError (msg, code, statusCode) {
  /** @type {Error & { code: string; status?: number; }} */
  const err = new Error(msg)
  err.code = code
  if (statusCode) {
    err.status = statusCode
  }
  return err
}
