/* eslint-env node */
/**
 * @fileoverview Class representing server configuration options.
 */

import debugFactory from 'debug'

import { strict as assert } from 'assert'
import net from 'net'
import path from 'path'

import isValidHostname from 'is-valid-hostname'

import { deepFreeze } from './utils.js'

const debug = debugFactory('colonialwars:server-config')

/**
 * @typedef {Object} ServerConfigOpts
 * @prop {Record<string, any>} config The configurations to use.
 * @prop {Record<string, any>} fallbacks Fallbacks to use.
 */

/**
 * ServerConfig class.
 *
 * The ServerConfig class represents configuration options accepted by
 * colonialwars-server.
 */
export default class ServerConfig {
  /**
   * Create a new ServerConfig object.
   *
   * The ServerConfig object created is immutable.
   * @param {ServerConfigOpts} opts Options.
   */
  constructor (opts) {
    this._opts = {
      ...opts.fallbacks,
      ...opts.config
    }
    this._tryConvert()
    this._validate()

    /**
     * Allowed CORS origins.
     * @type {Array<string>}
     */
    this.ALLOWED_ORIGINS = this._opts.ALLOWED_ORIGINS
    /**
     * Logging transports for winston.
     * @type {Array<import('../logging/loggers').TransportConfig>}
     */
    this.LOGGING_TRANSPORTS = this._opts.LOGGING_TRANSPORTS
    /**
     * Trusted proxy IPs.
     * @type {Array<string>}
     */
    this.TRUSTED_IPS = this._opts.TRUSTED_IPS
    /**
     * Are we in a production environment?
     * @type {boolean}
     */
    this.IS_PROD = this._opts.IS_PROD
    /**
     * The port to listen on.
     * @type {number}
     */
    this.PORT = this._opts.PORT
    /**
     * The hostname/IP to listen on.
     * @type {string}
     */
    this.HOST = this._opts.HOST
    /**
     * Maximum time (in milliseconds) to allow a connection to stay open
     * without IO.
     * @type {number}
     */
    this.SERVER_CONN_TIMEOUT = this._opts.SERVER_CONN_TIMEOUT
    /**
     * Maximum amount of client connections allowed on this server.
     * @type {number}
     */
    this.MAX_CLIENTS = this._opts.MAX_CLIENTS
    /**
     * Maximum amount of games to run on this server.
     * @type {number}
     */
    this.MAX_GAMES = this._opts.MAX_GAMES
    /**
     * The player speed.
     * @type {number}
     * @deprecated
     */
    this.PLAYER_SPEED = this._opts.PLAYER_SPEED
    /**
     * The number of games to run on startup.
     * @type {number}
     */
    this.STARTING_GAME_NUM = this._opts.STARTING_GAME_NUM
    /**
     * How many times to update per second.
     * @type {number}
     */
    this.UPDATE_LOOP_FREQUENCY = this._opts.UPDATE_LOOP_FREQUENCY
    /**
     * The base directory for game configuration files (i.e. CW Map Save File).
     * @type {string}
     */
    this.GAME_CONF_BASE_DIR = this._opts.GAME_CONF_BASE_DIR
    /**
     * All game configuration files that exist within the base directory.
     * @type {Array<string>}
     */
    this.GAME_CONFS = this._opts.GAME_CONFS
    /**
     * The string to sign game authorization HMACs with.
     * @type {string}
     */
    this.GAME_AUTH_SECRET = this._opts.GAME_AUTH_SECRET
    /**
     * The maximum amount of game authorizations to give out concurrently.
     * NO-OP as of 2022-04-23
     * @type {number}
     */
    this.AUTH_STORE_MAX_ENTRIES = this._opts.AUTH_STORE_MAX_ENTRIES
    /**
     * The maximum amount of time (in milliseconds) that this server will retain
     * valid game authorizations for.
     * @type {number}
     */
    this.AUTH_STORE_MAX_ENTRY_AGE = this._opts.AUTH_STORE_MAX_ENTRY_AGE

    deepFreeze(this)
  }

  /**
   * Try to convert all configurations to their expected types.
   * @private
   */
  _tryConvert () {
    const opts = this._opts

    try {
      opts.ALLOWED_ORIGINS = tryToArray(opts.ALLOWED_ORIGINS)
      opts.LOGGING_TRANSPORTS = tryToArray(opts.LOGGING_TRANSPORTS)
      opts.TRUSTED_IPS = tryToArray(opts.TRUSTED_IPS)
      opts.IS_PROD = opts.IS_PROD === 'true'
      opts.PORT = Number(opts.PORT)
      opts.HOST = String(opts.HOST)
      opts.SERVER_CONN_TIMEOUT = Number(opts.SERVER_CONN_TIMEOUT)
      opts.MAX_CLIENTS = Number(opts.MAX_CLIENTS)
      opts.MAX_GAMES = Number(opts.MAX_GAMES)
      /**
       * TODO: Move player speed to map config & data files.
       * Player speed shouldn't be global.
       * (04/21/2022) Take-Some-Bytes */
      opts.PLAYER_SPEED = Number(opts.PLAYER_SPEED)
      opts.STARTING_GAME_NUM = Number(opts.STARTING_GAME_NUM)
      opts.UPDATE_LOOP_FREQUENCY = Number(opts.UPDATE_LOOP_FREQUENCY)
      opts.GAME_CONF_BASE_DIR = String(opts.GAME_CONF_BASE_DIR)
      opts.GAME_CONFS = tryToArray(opts.GAME_CONFS)
      opts.GAME_AUTH_SECRET = String(opts.GAME_AUTH_SECRET)
      opts.AUTH_STORE_MAX_ENTRIES = Number(opts.AUTH_STORE_MAX_ENTRIES)
      opts.AUTH_STORE_MAX_ENTRY_AGE = Number(opts.AUTH_STORE_MAX_ENTRY_AGE)
    } catch (ex) {
      debug(ex.stack)
    } finally {
      this._opts = opts
    }
  }

  /**
   * Validate all configurations.
   * @private
   */
  _validate () {
    const opts = this._opts

    /// Type check ///
    assert.ok(typeof opts.IS_PROD === 'boolean', 'IS_PROD is not a boolean')
    assert.ok(typeof opts.PORT === 'number', 'PORT is not a number')
    assert.ok(typeof opts.HOST === 'string', 'HOST is not a string')
    assert.ok(typeof opts.SERVER_CONN_TIMEOUT === 'number', 'SERVER_CONN_TIMEOUT is not a number')
    assert.ok(typeof opts.MAX_CLIENTS === 'number', 'MAX_CLIENTS is not a number')
    assert.ok(typeof opts.MAX_GAMES === 'number', 'MAX_GAMES is not a number')
    assert.ok(typeof opts.STARTING_GAME_NUM === 'number', 'STARTING_GAME_NUM is not a number')
    assert.ok(typeof opts.UPDATE_LOOP_FREQUENCY === 'number', 'UPDATE_LOOP_FREQUENCY is not a number')
    assert.ok(typeof opts.GAME_CONF_BASE_DIR === 'string', 'GAME_CONF_BASE_DIR is not a string')
    assert.ok(typeof opts.GAME_CONFS === 'object', 'GAME_CONFS is not an object')
    assert.ok(typeof opts.ALLOWED_ORIGINS === 'object', 'ALLOWED_ORIGINS is not an object')
    assert.ok(typeof opts.LOGGING_TRANSPORTS === 'object', 'LOGGING_TRANSPORTS is not an object')
    assert.ok(typeof opts.TRUSTED_IPS === 'object', 'TRUSTED_IPS is not an object')
    assert.ok(typeof opts.GAME_AUTH_SECRET === 'string', 'GAME_AUTH_SECRET is not a string')
    assert.ok(typeof opts.AUTH_STORE_MAX_ENTRIES === 'number', 'AUTH_STORE_MAX_ENTRIES is not a number')
    assert.ok(typeof opts.AUTH_STORE_MAX_ENTRY_AGE === 'number', 'AUTH_STORE_MAX_ENTRY_AGE is not a number')
    assert.ok(Array.isArray(opts.GAME_CONFS), 'GAME_CONFS is not an array')
    assert.ok(Array.isArray(opts.LOGGING_TRANSPORTS), 'GAME_CONFS is not an array')
    assert.ok(Array.isArray(opts.TRUSTED_IPS), 'GAME_CONFS is not an array')
    assert.ok(Array.isArray(opts.ALLOWED_ORIGINS), 'ALLOWED_ORIGINS is not an array')

    /// NaN check ///
    assert.ok(!isNaN(opts.PORT), 'PORT is NaN')
    assert.ok(!isNaN(opts.SERVER_CONN_TIMEOUT), 'SERVER_CONN_TIMEOUT is NaN')
    assert.ok(!isNaN(opts.MAX_CLIENTS), 'MAX_CLIENTS is NaN')
    assert.ok(!isNaN(opts.MAX_GAMES), 'MAX_GAMES is NaN')
    assert.ok(!isNaN(opts.STARTING_GAME_NUM), 'STARTING_GAME_NUM is NaN')
    assert.ok(!isNaN(opts.UPDATE_LOOP_FREQUENCY), 'UPDATE_LOOP_FREQUENCY is NaN')
    assert.ok(!isNaN(opts.AUTH_STORE_MAX_ENTRIES), 'AUTH_STORE_MAX_ENTRIES is NaN')
    assert.ok(!isNaN(opts.AUTH_STORE_MAX_ENTRY_AGE), 'AUTH_STORE_MAX_ENTRY_AGE is NaN')

    /// Range check ///
    assert.ok(opts.PORT > 1024 && opts.PORT <= 65535, 'PORT is not in range')
    assert.ok(opts.SERVER_CONN_TIMEOUT > 0 && opts.SERVER_CONN_TIMEOUT <= 86400000, 'SERVER_CONN_TIMEOUT is not in range')
    assert.ok(opts.MAX_CLIENTS > 2 && opts.MAX_CLIENTS < 10000, 'MAX_CLIENTS is not in range')
    assert.ok(opts.MAX_GAMES > 0 && opts.MAX_GAMES < 1000, 'MAX_GAMES is not in range')
    assert.ok(opts.STARTING_GAME_NUM > 0 && opts.STARTING_GAME_NUM <= 1000, 'STARTING_GAME_NUM is not in range')
    assert.ok(opts.UPDATE_LOOP_FREQUENCY > 0 && opts.UPDATE_LOOP_FREQUENCY <= 60, 'UPDATE_LOOP_FREQUENCY is not in range')
    assert.ok(opts.AUTH_STORE_MAX_ENTRIES > 10 && opts.AUTH_STORE_MAX_ENTRIES <= 11000, 'AUTH_STORE_MAX_ENTRIES is not in range')
    assert.ok(opts.AUTH_STORE_MAX_ENTRY_AGE > 1000 && opts.AUTH_STORE_MAX_ENTRY_AGE <= 86400000, 'AUTH_STORE_MAX_ENTRY_AGE is not in range')

    /// String checks ///
    assert.ok(isValidPath(opts.GAME_CONF_BASE_DIR), 'GAME_CONF_BASE_DIR is not a valid path')
    assert.ok(isIpOrHostname(opts.HOST), 'HOST is not an IP or hostname')
  }
}

/**
 * Try to convert a piece of data to an array. If it cannot be converted,
 * returns null. ``null`` and ``undefined`` are converted to the empty array.
 * @param {unknown} unknown The data to convert.
 * @returns {Array | null}
 */
function tryToArray (unknown) {
  if (unknown === null || unknown === undefined) {
    return []
  }
  if (Array.isArray(unknown)) {
    return unknown
  }
  if (typeof unknown === 'string') {
    try {
      return Array.from(JSON.parse(unknown))
    } catch (ex) {
      debug(ex.stack)
      return null
    }
  }
  if (typeof unknown[Symbol.iterator] === 'function') {
    try {
      return Array.from(unknown)
    } catch (ex) {
      debug(ex.stack)
      return null
    }
  }

  debug('Could not convert %O to an array', unknown)

  return null
}
/**
 * Returns true if ``path.parse`` doesn't complain.
 * @param {string} str The string to test.
 * @returns {boolean}
 */
function isValidPath (str) {
  try {
    path.parse(str)
    return true
  } catch (ex) {
    return false
  }
}
/**
 * Returns true if ``str`` is a valid IP or hostname.
 * @param {string} str The string to test.
 * @returns {boolean}
 */
function isIpOrHostname (str) {
  return net.isIPv4(str) || net.isIPv6(str) || isValidHostname(str)
}
