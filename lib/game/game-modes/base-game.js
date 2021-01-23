/* eslint-env node */
/**
 * @fileoverview BaseGame class for basic functionality that all game modes need.
 */

const events = require('events')

const Player = require('../player')
const Vector2D = require('../physics/vector-2d')

/**
 * @typedef {Object<string, InstanceType<Vector2D>} StartPositions
 * @typedef {import('socket.io')} SocketIO
 *
 * @typedef {Object} Communications
 * @prop {string} SOCKET_UPDATE
 * @prop {string} SOCKET_REMOVE_PLAYER
 *
 * @typedef {Object} BaseGameConfig
 * @prop {string} id
 * @prop {string} name
 * @prop {string} mode
 * @prop {number} maxPlayers
 * @prop {WorldLimits} worldLimits
 * @prop {StartPositions} startPositions
 * @prop {PlayerStats} playerStats
 * @prop {import('debug').Debugger} debug
 * @prop {Communications} communications
 *
 * @typedef {Object} WorldLimits
 * @prop {number} WORLD_MAX
 * @prop {number} WORLD_MIN
 *
 * @typedef {Object} PlayerMeta
 * @prop {string} name
 * @prop {string} team
 *
 * @typedef {Object} PlayerStats
 * @prop {number} PLAYER_SPEED
 */

/**
 * BaseGame class.
 * @extends events.EventEmitter
 */
class BaseGame extends events.EventEmitter {
  /**
   * Constructor for a BaseGame class.
   * @param {BaseGameConfig} config Configurations.
   */
  constructor (config) {
    const {
      id, name, mode, maxPlayers, worldLimits,
      startPositions, debug, playerStats, communications
    } = config

    super()

    this.id = id
    this.name = name
    this.mode = mode
    this.debug = debug
    this.maxPlayers = maxPlayers
    this.worldLimits = worldLimits
    this.playerConstants = playerStats
    this.startPositions = startPositions
    /**
     * The Socket.IO events we are going to communicate with.
     */
    this.communications = communications

    /**
     * This is a Map containing all of the connected players
     * and socket ids associated with them.
     * @type {Map<string, InstanceType<Player>>}
     */
    this.players = new Map()
    /**
     * This is a Map containing all of the connected clients.
     * @type {Map<string, SocketIO.Socket>}
     */
    this.clients = new Map()
    this.currentPlayers = 0
    this.lastUpdateTime = 0
    /**
     * This property could be used to mark the current game as "closed", meaning
     * that no players could join the game, even if there is still enough space
     * left in the game.
     */
    this.closed = false
    this.deltaTime = 0
    this.full = false
    /**
     * For dev purposes only.
     */
    this.numEmits = 0
  }

  /**
   * Returns true if this game is currently accepting new players.
   * @returns {boolean}
   */
  get acceptingPlayers () {
    return !(this.closed || this.full)
  }

  /**
   * Initializes the game state.
   */
  init () {
    this.lastUpdateTime = Date.now()
    this.currentPlayers = 0
    this.full = false

    this.players.clear()
    this.clients.clear()
  }

  /**
   * Adds a new player into this game.
   * @param {SocketIO.Socket} socket The socket object associated with the player.
   * @param {PlayerMeta} meta Metadata about the player.
   */
  addNewPlayer (socket, meta) {
    if (this.closed || this.full) {
      throw new RangeError(
        'Could not add player. Game is either full or closed.'
      )
    }

    const startPosition = this.startPositions[meta.team]
    if (!(startPosition instanceof Vector2D)) {
      throw new TypeError('Team does not exist!')
    }
    this.clients.set(socket.id, socket)
    this.players.set(socket.id, new Player({
      name: meta.name,
      team: meta.team,
      socketID: socket.id,
      position: startPosition.copy(),
      PLAYER_SPEED: this.playerConstants.PLAYER_SPEED,
      WORLD_BOUNDS: {
        MAX: this.worldLimits.WORLD_MAX,
        MIN: this.worldLimits.WORLD_MIN
      }
    }))
    this.currentPlayers++

    if (this.currentPlayers === this.maxPlayers) {
      this.full = true
      this.emit('capacity-change', {
        full: true,
        currentPlayers: this.currentPlayers,
        maxPlayers: this.maxPlayers
      })
    }
  }

  /**
   * Clears all players currently in this BaseGame.
   * @param {string} message A message describing why all the players were cleared.
   */
  clearPlayers (message) {
    const clients = Array.from(this.clients.entries())
    this.clients.clear()
    for (const [id, client] of clients) {
      if (this.players.has(id)) {
        this.players.delete(id)
        this.currentPlayers--
        if (this.currentPlayers < this.maxPlayers) {
          this.full = false
        }
      }
      client.emit(this.communications.SOCKET_REMOVE_PLAYER, JSON.stringify({
        reason: message
      }))
    }
  }

  /**
   * Removes the specified player from this BaseGame, and returns the name of
   * the player that was removed.
   * @param {string} socketID The Socket ID associated with the player
   * you want to remove from this game.
   * @param {string} message A message describing why the player has been removed.
   */
  removePlayer (socketID, message) {
    let playerName = null
    if (this.clients.has(socketID)) {
      if (this.players.has(socketID)) {
        const player = this.players.get(socketID)
        this.players.delete(socketID)
        this.currentPlayers--
        if (this.currentPlayers < this.maxPlayers) {
          this.full = false
        }
        playerName = player.name
      }
      const client = this.clients.get(socketID)
      this.clients.delete(socketID)
      client.emit(this.communications.SOCKET_REMOVE_PLAYER, JSON.stringify({
        reason: message
      }))
      return playerName
    }
  }

  /**
   * Basic functionality of a game update. Not to be called by end-users,
   * should not be modified, and could only be used within methods of this
   * class and sub-classes.
   * @private
   */
  _update () {
    const currentTime = Date.now()
    this.deltaTime = currentTime - this.lastUpdateTime
    this.lastUpdateTime = currentTime

    const players = Array.from(this.players.values())

    if (players.length > 0) {
      players.forEach(player => {
        player.update(this.lastUpdateTime, this.deltaTime)
      })
    }
  }

  /**
   * Performs a game update. This method should be overridden.
   * @abstract
   */
  update () {
    this._update()
  }

  /**
   * Sends the game state to all connected clients in this game.
   */
  sendState () {
    this.numEmits++
    this.clients.forEach((client, id) => {
      const currentPlayer = this.players.get(id)
      const state = JSON.stringify({
        self: currentPlayer
      })
      if (this.numEmits > 25 * 30) {
        this.debug('Packet size: ', Buffer.from(state, 'utf-8').byteLength, 'bytes.')
        this.numEmits = 0
      }

      client.emit(this.communications.SOCKET_UPDATE, state)
    })
  }
}

module.exports = exports = BaseGame
