/* eslint-env node */
/**
 * @fileoverview GameLoader class to manage the loading of games.
 */

const path = require('path')
const fs = require('fs').promises

const Vector2D = require('./physics/vector-2d')
const TeamGame = require('./game-modes/team-game')

/**
 * @typedef {'teams'|'KOTH'|'siege'} GameModes
 * @typedef {InstanceType<TeamGame>} TeamGameInstance
 * @typedef {TeamGameInstance} GameInstances
 *
 * @typedef {Object} GameConfig
 * @prop {'game-config'} configType
 * @prop {Object} meta
 * @prop {string} meta.name
 * @prop {GameModes} meta.mode
 * @prop {number} meta.maxPlayers
 * @prop {import('./game-modes/base-game').WorldLimits} meta.worldLimits
 * @prop {Object<string, import('./physics/vector-2d').Vector2DLike>} meta.startPositions
 *
 * @typedef {Object} GameConstants
 * @prop {import('./game-modes/base-game').PlayerStats} playerStats
 * @prop {import('./game-modes/base-game').Communications} communications
 *
 * @typedef {Object} GameLoaderConfig
 * @prop {string} baseDir
 * @prop {number} maxConfSize
 * @prop {GameConstants} gameConstants
 * @prop {import('debug').Debugger} debug
 */

/**
 * GameLoader class.
 */
class GameLoader {
  /**
   * Default maximum game configuration file size (in bytes).
   * @readonly
   * @returns {1073741824}
   */
  static get DEFAULT_MAX_CONF_SIZE () {
    return 1073741824
  }

  /**
   * Constructor for a GameLoader class.
   * @param {GameLoaderConfig} config Configurations.
   */
  constructor (config) {
    const { baseDir, maxConfSize, debug, gameConstants } = config

    this.debug = debug
    this.baseDir = baseDir
    this.gameConstants = gameConstants
    this.maxConfSize = typeof maxConfSize === 'number'
      ? maxConfSize
      : GameLoader.DEFAULT_MAX_CONF_SIZE
  }

  /**
   * Loads a configuration file for a game.
   * @param {string} filePath The path of the game config file, relative to this GameLoader's
   * ``.baseDir`` property.
   * @returns {Promise<GameConfig>}
   */
  async loadConfigFile (filePath) {
    const realPath = path.join(this.baseDir, filePath)
    const stats = await fs.stat(realPath)
    if (stats.size > this.maxConfSize) {
      throw new RangeError('Game configuration file is too large!')
    } else if (!stats.isFile()) {
      throw new TypeError('Path does not lead to a valid file!')
    }
    const file = (await fs.readFile(realPath)).toString('utf-8')
    /**
     * @type {GameConfig}
     */
    const config = JSON.parse(file)
    if (!config || config.configType !== 'game-config') {
      throw new TypeError('Invalid configuration file!')
    }
    return config
  }

  /**
   * Loads a game from a specific file.
   * @param {string} filePath The path of the game config file, relative to this
   * GameLoader's ``.baseDir`` property.
   * @param {string} gameID The ID of the game that's going to be created.
   * @returns {Promise<GameInstances>}
   */
  async loadFromFile (filePath, gameID) {
    const config = await this.loadConfigFile(filePath)

    switch (config.meta.mode.toUpperCase()) {
      case 'TEAMS': {
        return new TeamGame({
          id: gameID,
          name: config.meta.name,
          mode: config.meta.mode,
          maxPlayers: config.meta.maxPlayers,
          worldLimits: config.meta.worldLimits,
          startPositions: (() => {
            const objToReturn = {}
            Object.keys(config.meta.startPositions).forEach(key => {
              const val = config.meta.startPositions[key]
              objToReturn[key] = Vector2D.fromObject(val)
            })
            return objToReturn
          })(),
          debug: this.debug,
          playerStats: this.gameConstants.playerStats,
          communications: this.gameConstants.communications
        })
      }
      default: {
        throw new Error('Unrecognized game mode!')
      }
    }
  }
}

module.exports = exports = GameLoader
