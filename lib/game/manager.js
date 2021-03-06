/* eslint-env node */
/**
 * @fileoverview Manager class to manage games running on the server.
 */

const EventEmitter = require('events')

const debug = require('debug')('colonialwars:manager')

/**
 * @typedef {Object} ManagerConfig
 * @prop {number} maxGames
 * @prop {number} startGames
 * @prop {number} updateLoopFrequency The amount of game updates to perform per second.
 * @prop {Array<string>} gameConfs An array of game configurations' paths, relative
 * to the passed-in game loader base path.
 * @prop {InstanceType<import('./gameloader')>} gameLoader
 * @prop {InstanceType<import('../logging/loggers')>} loggers
 *
 * @typedef {Object} CapacityStats
 * @prop {boolean} full
 * @prop {number} maxPlayers
 * @prop {number} currentPlayers
 */

/**
 * Manager class.
 */
class Manager extends EventEmitter {
  /**
   * Constructor for a Manager class.
   * @param {ManagerConfig} config Configurations.
   */
  constructor (config) {
    const {
      gameConfs, gameLoader, loggers,
      maxGames, startGames, updateLoopFrequency
    } = config
    super()

    this.loggers = loggers
    this.maxGames = maxGames
    this.gameConfs = gameConfs
    this.startGames = startGames
    this.gameLoader = gameLoader
    this.updateLoopFrequency = updateLoopFrequency

    /**
     * This is a Map containing all of the games running
     * on the server.
     * @type {Map<string, InstanceType<import('./game-modes/base-game')>>}
     */
    this.games = new Map()
    /**
     * This is an array containing the names of all the players in every game
     * that is being managed by this Manager.
     * @type {Array<string>}
     */
    this.playerNames = []
    this.updateLoop = null
    this.numClients = 0
  }

  /**
   * Gets the games that are accepting players.
   * @returns {Array<InstanceType<import('./game-modes/base-game')>>}
   */
  get availableGames () {
    return Array.from(this.games.values()).filter(game => game.acceptingPlayers)
  }

  /**
   * Handler for the BaseGame class's ``capacity-change`` event.
   * @param {CapacityStats} capacityStats Stats about the game's capacity.
   * @private
   */
  _onGameCapacityChange (capacityStats) {
    this.emit('game-capacity-change')
  }

  /**
   * Starts this Manager's update loop.
   */
  startUpdateLoop () {
    this.updateLoop = setInterval(() => {
      for (const game of this.games.values()) {
        game.update()
        game.sendState()
      }
    }, 1000 / this.updateLoopFrequency)
    debug('Started update loop at %d updates/sec', this.updateLoopFrequency)
  }

  /**
   * Stops this Manager's update loop.
   */
  stopUpdateLoop () {
    clearInterval(this.updateLoop)
    this.updateLoop = null
    debug('Stopped update loop.')
  }

  /**
   * Adds a new client to a game.
   * @param {string} gameID The game's ID.
   * @param {InstanceType<import('../cwdtp/conn')>} conn The WSConn object associated with the client.
   * @param {import('./game-modes/base-game').PlayerMeta} playerMeta Player information.
   */
  addClientToGame (gameID, conn, playerMeta) {
    if (this.games.has(gameID)) {
      const game = this.games.get(gameID)
      game.addNewPlayer(conn, playerMeta)
      this.playerNames.push(playerMeta.name)
      this.numClients++
      return
    }
    throw new Error('Game does not exist; cannot add client to game')
  }

  /**
   * Rremoves the specified client from the specified game.
   * @param {string} gameID The game's ID.
   * @param {InstanceType<import('../cwdtp/conn')>} conn The WSConn object associated with the client.
   */
  removeClientFromGame (gameID, conn) {
    if (this.games.has(gameID)) {
      const game = this.games.get(gameID)
      const playerName = game.removePlayer(conn.id)
      this.playerNames.splice(this.playerNames.indexOf(playerName), 1)
      this.numClients--
    }
  }

  /**
   * Returns true if a player exists.
   * @param {string} name The name of the player.
   * @returns {boolean}
   */
  playerExists (name) {
    return this.playerNames.includes(name)
  }

  /**
   * Returns true if the specified game has a team.
   * @param {string} gameID The ID of the game to test.
   * @param {string} team The team to check.
   * @returns {boolean}
   */
  hasTeam (gameID, team) {
    const game = this.getGame(gameID)
    if (game) {
      return game.availableTeams.includes(team)
    }
  }

  /**
   * Gets the specified game.
   * @param {string} gameID The game's ID.
   * @returns {InstanceType<import('./game-modes/base-game')>}
   */
  getGame (gameID) {
    if (this.games.has(gameID)) {
      return this.games.get(gameID)
    }
  }

  /**
   * Creates a new game, with its configurations randomly selected from
   * the list of available configuration paths.
   * @returns {Promise<import('./gameloader').GameInstances>}
   */
  async newRandomGame () {
    if ((this.games.size + 1) > this.maxGames) {
      throw new RangeError('Maximum amount of games reached!')
    }
    if (!(this.gameConfs instanceof Array)) {
      throw new TypeError('Game configurations must be an array!')
    }
    const index = Math.floor(Math.random() * this.gameConfs.length)
    const gameConf = this.gameConfs[index]

    const game = await this.gameLoader.loadFromFile(
      gameConf, this.games.size + 1
    )
    game.on('capacity-change', this._onGameCapacityChange.bind(this))
    this.games.set(`game-${game.id}`, game)
    this.emit('new-game', game)
    return game
  }

  /**
   * Initializes this Manager instance.
   */
  async init () {
    // First, create the starting amount of games.
    debug('Creating %d games on initialization.', this.startGames)
    for (let i = 0; i < this.startGames; i++) {
      await this.newRandomGame()
    }
  }

  /**
   * Creates a Manager object. This is mainly here so that the created Manager
   * instance could be initialized automatically.
   * @param {ManagerConfig} config Configurations.
   * @returns {Promise<Manager>}
   */
  static async create (config) {
    const manager = new Manager(config)
    await manager.init()
    return manager
  }
}

module.exports = exports = Manager
