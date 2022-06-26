/* eslint-env node */
/**
 * @fileoverview BaseGame class for basic functionality that all game modes need.
 */

const events = require('events')
const debug = require('debug')('colonialwars:basegame')

const Player = require('../player')
const Vector2D = require('../physics/vector-2d')

/**
 * @typedef {InstanceType<import('../../cwdtp/conn')>} WSConnInstance
 *
 * @typedef {Object} Communications
 * @prop {string} CONN_UPDATE
 * @prop {string} CONN_REMOVE_PLAYER
 *
 * @typedef {Object} BaseGameConfig
 * @prop {string} id
 * @prop {import('../map-config')} mapConfig
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
      id, mapConfig
    } = config

    super()

    this.id = id
    this.mapConfig = mapConfig
    this.mode = mapConfig.mode
    this.name = mapConfig.mapName
    this.tileType = mapConfig.tileType
    this.maxPlayers = mapConfig.maxPlayers
    this.description = mapConfig.description
    this.worldLimits = mapConfig.worldLimits
    this.availableTeams = mapConfig.teams.map(
      teamData => teamData.name
    )
    this.teams = new Map(mapConfig.teams.map(t => [
      t.name,
      {
        ...t,
        spawnPosition: Vector2D.fromObject(t.spawnPosition),
        currentPlayers: 0
      }
    ]))

    /**
     * This is a Map containing all of the connected players
     * and IDs associated with them.
     * @type {Map<string, InstanceType<Player>>}
     */
    this.players = new Map()
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
  }

  /**
   * Adds a new player into this game.
   * @param {string} id The ID associated with the player.
   * @param {PlayerMeta} meta Metadata about the player.
   */
  addPlayer (id, meta) {
    if (this.closed || this.full) {
      throw new RangeError(
        'Could not add player. Game is either full or closed.'
      )
    }

    const team = this.teams.get(meta.team)
    if (!team) {
      throw new TypeError('Team does not exist!')
    }
    if (team.currentPlayers === team.maxPlayers) {
      throw new RangeError('Team is full!')
    }

    team.currentPlayers++

    this.players.set(id, new Player({
      name: meta.name,
      team: meta.team,
      socketID: id,
      position: team.spawnPosition.copy(),
      PLAYER_SPEED: this.mapConfig.player.speed,
      WORLD_BOUNDS: {
        x: {
          MIN: 0, MAX: this.mapConfig.worldLimits.x
        },
        y: {
          MIN: 0, MAX: this.mapConfig.worldLimits.y
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
   */
  clearPlayers () {
    for (const id of this.players.keys()) {
      this.removePlayer(id)
    }
  }

  /**
   * Removes the specified player from this BaseGame, and returns the name of
   * the player that was removed.
   * @param {string} id The ID associated with the player.
   * @returns {string|null}
   */
  removePlayer (id) {
    if (!this.players.has(id)) {
      return null
    }
    const player = this.players.get(id)
    this.players.delete(id)
    debug('Removed client and player %s from game %s', id, this.id)

    this.currentPlayers--
    this.teams.get(player.team).currentPlayers--

    if (this.currentPlayers < this.maxPlayers) {
      this.full = false
      this.emit('capacity-change', {
        full: false,
        currentPlayers: this.currentPlayers,
        maxPlayers: this.maxPlayers
      })
    }

    return player.name
  }

  /**
   * Gets the player associated with the ID, or undefined if there is
   * no player associated with the ID.
   * @param {string} id The ID associated with the player.
   */
  getPlayerByID (id) {
    if (this.players.has(id)) {
      return this.players.get(id)
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
   * Serializes the state of the game for one player. Returns the game state
   * in JSON format.
   * @param {string} playerID The ID of the player to serialize game state for.
   * @returns {string}
   */
  serializeStateFor (playerID) {
    if (!this.players.has(playerID)) {
      throw new Error('Player does not exist!')
    }

    const player = this.players.get(playerID)
    return JSON.stringify({
      self: player
    })
  }
}

module.exports = BaseGame
