/* eslint-env node */
/**
 * @fileoverview BaseGame class for basic functionality that all game modes need.
 */

const events = require('events')
const debug = require('debug')('colonialwars:basegame')

const Player = require('../player')
const Vector2D = require('../physics/vector-2d')

/**
 * @typedef {Object<string, InstanceType<Vector2D>} StartPositions
 * @typedef {InstanceType<import('../../cwdtp/conn')>} WSConnInstance
 *
 * @typedef {Object} Communications
 * @prop {string} CONN_UPDATE
 * @prop {string} CONN_REMOVE_PLAYER
 *
 * @typedef {Object} BaseGameConfig
 * @prop {string} id
 * @prop {string} name
 * @prop {string} mode
 * @prop {number} maxPlayers
 * @prop {string} description
 * @prop {WorldLimits} worldLimits
 * @prop {PlayerStats} playerStats
 * @prop {GraphicsData} graphicsData
 * @prop {Communications} communications
 * @prop {Array<import('../gameloader').TeamData>} teams
 *
 * @typedef {Object} WorldLimits
 * @prop {number} x
 * @prop {number} y
 *
 * @typedef {Object} PlayerMeta
 * @prop {string} name
 * @prop {string} team
 *
 * @typedef {Object} PlayerStats
 * @prop {number} PLAYER_SPEED
 *
 * @typedef {Object} GraphicsData
 * @prop {'grass'|'sand'} theme
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
      id, name, mode, maxPlayers, worldLimits, description,
      teams, playerStats, graphicsData, communications
    } = config

    super()

    this.id = id
    this.name = name
    this.mode = mode
    this.mapTheme = graphicsData.theme
    this.maxPlayers = maxPlayers
    this.worldLimits = worldLimits
    this.description = description
    this.graphicsData = graphicsData
    this.playerConstants = playerStats
    /**
     * @type {StartPositions}
     */
    this.startPositions = Object.fromEntries(
      teams.map(
        teamData => [teamData.name, Vector2D.fromObject(teamData.spawnPosition)]
      )
    )
    /**
     * The Socket.IO events we are going to communicate with.
     */
    this.communications = communications

    this.availableTeams = teams.map(
      teamData => teamData.name
    )

    /**
     * This is a Map containing all of the connected players
     * and socket ids associated with them.
     * @type {Map<string, InstanceType<Player>>}
     */
    this.players = new Map()
    /**
     * This is a Map containing all of the connected clients.
     * @type {Map<string, WSConnInstance>}
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
   * @param {WSConnInstance} conn The socket object associated with the player.
   * @param {PlayerMeta} meta Metadata about the player.
   */
  addNewPlayer (conn, meta) {
    if (this.closed || this.full) {
      throw new RangeError(
        'Could not add player. Game is either full or closed.'
      )
    }

    const startPosition = this.startPositions[meta.team]
    if (!(startPosition instanceof Vector2D)) {
      throw new TypeError('Team does not exist!')
    }
    this.clients.set(conn.id, conn)
    this.players.set(conn.id, new Player({
      name: meta.name,
      team: meta.team,
      socketID: conn.id,
      position: startPosition.copy(),
      PLAYER_SPEED: this.playerConstants.PLAYER_SPEED,
      WORLD_BOUNDS: {
        x: {
          MIN: 0, MAX: this.worldLimits.x
        },
        y: {
          MIN: 0, MAX: this.worldLimits.y
        }
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
   * @param {string} [reason] A reason describing why all the players were cleared.
   * @param {boolean} [sendReason=true] Whether to send the client a reason for removal.
   */
  clearPlayers (reason, sendReason = true) {
    Array.from(this.clients.keys()).forEach(id => {
      this.removePlayer(id, reason, sendReason)
    })
  }

  /**
   * Removes the specified player from this BaseGame, and returns the name of
   * the player that was removed.
   * @param {string} wsconnID The WSConn ID associated with the player.
   * @param {string} [reason] A reason why the player is being removed.
   * @param {boolean} [sendReason=true] Whether to send the client a reason for removal.
   */
  removePlayer (wsconnID, reason, sendReason = true) {
    if (!this.clients.has(wsconnID)) {
      return
    }
    if (!this.players.has(wsconnID)) {
      return
    }
    const client = this.clients.get(wsconnID)
    const player = this.players.get(wsconnID)
    this.clients.delete(wsconnID)
    this.players.delete(wsconnID)
    debug('Removed client and player object from game')

    this.currentPlayers--
    if (this.currentPlayers < this.maxPlayers) {
      this.full = false
    }

    if (sendReason) {
      client.emit(this.communications.CONN_REMOVE_PLAYER, JSON.stringify({
        reason
      }))
    }
    return player.name
  }

  /**
   * Gets the player associated with the WSConn ID, or undefined if there is
   * no player associated with the ID.
   * @param {string} wsconnID The WSConn ID associated with the player.
   */
  getPlayerByConnID (wsconnID) {
    if (this.players.has(wsconnID)) {
      return this.players.get(wsconnID)
    }
  }

  /**
   * Basic functionality of a game update. Not to be called by end-users,
   * should not be modified, and should only be used within methods of this
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
        debug('Packet size: ', Buffer.from(state, 'utf-8').byteLength, 'bytes.')
        this.numEmits = 0
      }

      client.emit(this.communications.CONN_UPDATE, state)
    })
  }
}

module.exports = exports = BaseGame
