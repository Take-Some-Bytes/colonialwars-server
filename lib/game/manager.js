/* eslint-env node */
/**
 * @fileoverview Manager class to manage games running on the server.
 */

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
class Manager {
  /**
   * Constructor for a Manager class.
   * @param {ManagerConfig} config Configurations.
   */
  constructor (config) {
    const {
      gameConfs, gameLoader, loggers,
      maxGames, startGames, updateLoopFrequency
    } = config

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
    this.updateLoop = null
  }

  /**
   * Handler for the BaseGame class's ``capacity-change`` event.
   * @param {CapacityStats} capacityStats Stats about the game's capacity.
   * @private
   */
  _onGameCapacityChange (capacityStats) {}

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
  }

  /**
   * Stops this Manager's update loop.
   */
  stopUpdateLoop () {
    clearInterval(this.updateLoop)
    this.updateLoop = null
  }

  /**
   * Adds a new client to a game.
   * @param {string} gameID The game's ID.
   * @param {SocketIO.Socket} socket The socket object associated with the client.
   * @param {import('./game-modes/base-game').PlayerMeta} playerMeta Player information.
   */
  addClientToGame (gameID, socket, playerMeta) {
    if (this.games.has(gameID)) {
      const game = this.games.get(gameID)
      game.addNewPlayer(socket, playerMeta)
      return
    }
    throw new Error('Game does not exist; cannot add client to game')
  }

  /**
   * Rremoves the specified client from the specified game.
   * @param {string} gameID The game's ID.
   * @param {SocketIO.Socket} socket The socket object associated with the client.
   */
  removeClientFromGame (gameID, socket) {
    if (this.games.has(gameID)) {
      const game = this.games.get(gameID)
      game.removePlayer(socket.id)
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
    throw new Error('Game does not exist; cannot get game.')
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
    const index = Math.floor(Math.random() * this.gameConfs.length)
    const gameConf = this.gameConfs[index]

    if (typeof gameConf !== 'string') {
      // Try again.
      return await this.newRandomGame()
    }

    const game = await this.gameLoader.loadFromFile(
      gameConf, this.games.size + 1
    )
    game.on('capacity-change', this._onGameCapacityChange.bind(this))
    this.games.set(`game-${game.id}`, game)
    return game
  }

  /**
   * Initializes this Manager instance.
   */
  async init () {
    // First, create the starting amount of games.
    for (let i = 0; i < this.startGames; i++) {
      await this.newRandomGame()
    }
  }
}

module.exports = exports = Manager
