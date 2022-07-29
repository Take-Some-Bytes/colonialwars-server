/* eslint-env node */
/**
 * @fileoverview Manager class to manage games running on the server.
 */

import debugFactory from 'debug'

import path from 'path'
import events from 'events'

import MapConfig from './map-config.js'
import constants from '../constants.js'
import * as games from './modes/index.js'

const debug = debugFactory('colonialwars:manager')
const { COMMUNICATIONS: communications } = constants

/**
 * @typedef {Object} DataFilesConfig
 * @prop {string} location The base directory of the data files.
 * @prop {Array<string>} availableMaps An array of available map config files.
 *
 * @typedef {Object} ManagerConfig
 * @prop {number} maxGames
 * @prop {number} startGames
 * @prop {number} updateLoopFrequency The amount of game updates to perform per second.
 * @prop {InstanceType<import('../logging/loggers')>} loggers
 * @prop {DataFilesConfig} dataFiles An object which specify data file related configurations.
 *
 * @typedef {Object} CapacityStats
 * @prop {boolean} full
 * @prop {number} maxPlayers
 * @prop {number} currentPlayers
 */
/**
 * @typedef {import('colonialwars-lib/cwdtp').WSConn<string>} WSConnInstance
 * @typedef {import('./modes/base-game').PlayerMeta} PlayerMeta
 * @typedef {import('./components/player').PlayerInput} PlayerInput
 *
 * @typedef {Omit<PlayerInput, 'timestamp'>} RawPlayerInput
 * @typedef {Record<'id'|'name'|'mode'|'description', string>} GameInfo
 * @typedef {Map<string, WSConnInstance>} ClientMap
 *
 * @typedef {Object} Team
 * @prop {string} name
 * @prop {boolean} full
 *
 * @typedef {Object} MapData
 * @prop {string} tileType
 * @prop {Array<any>} obstacles
 * @prop {Array<any>} decorations
 * @prop {import('./physics/vector2d').Vector2DLike} worldLimits
 *
 * @typedef {Object} GameHandle
 * @prop {number} maxPlayers
 * @prop {number} currentPlayers
 * @prop {() => void} clearPlayers
 * @prop {() => GameInfo} getInfo
 * @prop {() => MapData} getMapData
 * @prop {() => Array<Team>} getTeams
 * @prop {(name: string) => boolean} hasTeam
 * @prop {(name: string) => boolean} teamFull
 * @prop {(id: string, input: RawPlayerInput) => void} addInputTo
 * @prop {(conn: WSConnInstance, meta: PlayerMeta) => void} addPlayer
 * @prop {(conn: WSConnInstance) => void} removePlayer
 */

/**
 * Manager class.
 */
export default class Manager extends events.EventEmitter {
  /**
   * Constructor for a Manager class.
   * @param {ManagerConfig} config Configurations.
   */
  constructor (config) {
    const { maxGames, startGames, loggers, updateLoopFrequency, dataFiles } = config
    super()

    this.loggers = loggers
    this.maxGames = maxGames
    this.startGames = startGames
    this.updateLoopFrequency = updateLoopFrequency

    this.dataFiles = dataFiles
    this.dataFilesCache = {
      /**
       * A cache of all the map configs that had been loaded.
       * @type {Map<string, MapConfig>}
       */
      maps: new Map()
    }

    /**
     * This is a Map containing all of the games running
     * on the server.
     * @type {Map<string, import('./modes/base-game')>}
     * @private
     */
    this._games = new Map()
    /**
     * A Map of all the game IDs and their associated client connections.
     * @type {Map<string, ClientMap>}
     */
    this.clients = new Map()
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
   * Gets all games that are currently running.
   * @returns {Array<GameHandle>}
   */
  get games () {
    return Array.from(this._games.keys())
      .map(gameID => this.getGame(gameID))
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
      for (const game of this._games.values()) {
        const clients = this.clients.get(`game-${game.id}`)

        game.update()

        for (const state of game.serializeState()) {
          clients.get(state.id).emit(communications.CONN_UPDATE, state.contents)
        }
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
   * @param {import('./modes/base-game').PlayerMeta} playerMeta Player information.
   */
  addClientTo (gameID, conn, playerMeta) {
    if (this._games.has(gameID)) {
      const game = this._games.get(gameID)
      game.addPlayer(conn.id, playerMeta)

      this.clients.get(gameID).set(conn.id, conn)

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
  removeClientFrom (gameID, conn) {
    if (this._games.has(gameID)) {
      const game = this._games.get(gameID)
      const playerName = game.removePlayer(conn.id)

      this.clients.get(gameID).delete(conn.id)

      this.playerNames.splice(this.playerNames.indexOf(playerName), 1)
      this.numClients--
    }
  }

  /**
   * Clears all the clients from the specified game.
   * @param {string} gameID The game's ID.
   */
  clearClientsFrom (gameID) {
    if (this._games.has(gameID)) {
      const game = this._games.get(gameID)

      for (const name of game.allPlayerNames()) {
        this.playerNames.splice(this.playerNames.indexOf(name), 1)
        this.numClients--
      }
      game.clearPlayers()

      this.clients.get(gameID).clear()
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
    const game = this._games.get(gameID)
    if (game) {
      return game.availableTeams.includes(team)
    }
  }

  /**
   * Gets the specified game.
   * @param {string} gameID The game's ID.
   * @returns {GameHandle}
   */
  getGame (gameID) {
    const game = this._games.get(gameID)

    if (this._games.has(gameID)) {
      return {
        get maxPlayers () {
          return game.maxPlayers
        },
        get currentPlayers () {
          return game.currentPlayers
        },
        hasTeam: name => {
          return game.teams.has(name)
        },
        teamFull: name => {
          const team = game.teams.get(name)

          return team.currentPlayers === team.maxPlayers
        },
        getInfo: () => {
          return {
            id: game.id,
            name: game.name,
            mode: game.mode,
            description: game.description
          }
        },
        getTeams: () => {
          return Array.from(game.teams.values())
            .map(t => ({ name: t.name, full: t.currentPlayers === t.maxPlayers }))
        },
        getMapData: () => {
          return {
            // Hard-coded for now.
            obstacles: [],
            decorations: [],
            tileType: game.tileType,
            worldLimits: game.worldLimits
          }
        },
        addInputTo: (id, input) => {
          game.addInputTo(id, input)
        },
        addPlayer: (...args) => {
          this.addClientTo(gameID, ...args)
        },
        removePlayer: conn => {
          this.removeClientFrom(gameID, conn)
        },
        clearPlayers: () => {
          this.clearClientsFrom(gameID)
        }
      }
    }
  }

  /**
   * Creates a new game, with its configurations randomly selected from
   * the list of available configuration paths.
   * @returns {Promise<import('./gameloader').GameInstances>}
   */
  async newRandomGame () {
    const location = this.dataFiles.location
    const availableFiles = this.dataFiles.availableMaps

    if ((this._games.size + 1) > this.maxGames) {
      throw new RangeError('Maximum amount of games reached!')
    }
    if (!(availableFiles instanceof Array)) {
      throw new TypeError('Game configurations must be an array!')
    }
    const index = Math.floor(Math.random() * availableFiles.length)
    const file = availableFiles[index]

    // Retrieve map config from cache if possible, otherwise laod
    // it from disk.
    const config = await (async () => {
      if (this.dataFilesCache.maps.has(file)) {
        return this.dataFilesCache.maps.get(file)
      } else {
        const _config = await MapConfig.fromFile(path.join(location, file))
        this.dataFilesCache.maps.set(file, _config)
        return _config
      }
    })()

    const game = games.createWithMode(config.mode, {
      id: this._games.size + 1,
      mapConfig: config
    })

    game.on('capacity-change', this._onGameCapacityChange.bind(this))
    this._games.set(`game-${game.id}`, game)
    this.clients.set(`game-${game.id}`, new Map())
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
