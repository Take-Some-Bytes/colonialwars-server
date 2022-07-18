/* eslint-env browser */
/**
 * @fileoverview MapConfig class to manage parsing and validating map configurations.
 */

import { promises as fs } from 'fs'

import Joi from 'joi'

import Vector2D from './physics/vector2d.js'
import { deepFreeze } from '../utils/utils.js'
import { MapConfigSchema } from './config-schemas.js'

/**
 * @typedef {Object} Team
 * @prop {string} name
 * @prop {number} maxPlayers
 * @prop {string} description
 * @prop {InstanceType<import('./physics/vector2d')>} spawnPosition
 *
 * @typedef {Object} Graphic
 * @prop {string} id
 * @prop {string} name
 * @prop {string} file
 * @prop {number} angles
 * @prop {boolean} hasAnimations
 * @prop {StaticImage} mainImg
 * @prop {StaticImage} damaged1Img
 * @prop {StaticImage} damaged2Img
 * @prop {StaticImage} constructing1Img
 * @prop {Record<DynAnimationKeys, DynAnimation>} animations
 *
 * @typedef {Object} Modification
 * @prop {string} field
 * @prop {number} add
 * @prop {number} multiply
 *
 * @typedef {Object} Aura
 * @prop {string} modifier
 * @prop {number} range
 *
 * @typedef {Object} Modifier
 * @prop {string} id
 * @prop {string} name
 * @prop {string} description
 * @prop {number} duration
 * @prop {number} maxStack
 * @prop {Array<Modification>} modifications
 * @prop {Array<Aura>} auras
 * @prop {boolean} auraHitsSelf
 * @prop {boolean} auraHitsFriendly
 * @prop {boolean} auraHitsAllied
 * @prop {boolean} auraHitsEnemy
 * @prop {Rgba} auraColour
 * @prop {Array<string>} auraTargetFilters
 * @prop {Array<string>} auraTargetFiltersExclude
 * @prop {Array<string>} disableCommands
 * @prop {boolean} changeEntityImg
 * @prop {string} entityImg
 * @prop {boolean} changeAtkEffect
 * @prop {string} atkEffect
 * @prop {Array<string>} effects
 * @prop {string} sound
 * @prop {number} soundVolume
 * @prop {Array<string>} removeModifiers
 *
 * @typedef {Object} PlayerConfig
 * @prop {string} img
 * @prop {number} speed
 */

/**
 * MapConfig class to manage parsing and validating map configurations.
 */
export default class MapConfig {
  /**
   * Creates a new MapConfig object from the provided JSON file. A MapConfig object
   * takes care of validation and parsing, and exposes map data in an intuitive way.
   * @param {string} rawConfig The map configuration, in JSON format.
   */
  constructor (rawConfig) {
    if (!rawConfig) {
      throw new Error('No configurations received!')
    }

    const config = JSON.parse(rawConfig)
    Joi.assert(config, MapConfigSchema)

    this._config = config

    deepFreeze(this)
  }

  /**
   * Creates a MapConfig object from the specified file on disk.
   * @param {string} path The path of the file.
   * @param {any} [opts] ``fs.readFile`` options.
   * @returns {Promise<MapConfig>}
   */
  static async fromFile (path, opts) {
    const file = await fs.readFile(path, opts)
    return new MapConfig(file)
  }

  /**
   * The game mode of the map, in lowercase.
   * @returns {string}
   * @readonly
   */
  get mode () {
    return this._config.meta.mode.toLowerCase()
  }

  /**
   * The tile type of the map.
   * @returns {string}
   * @readonly
   */
  get tileType () {
    return this._config.meta.tileType.toLowerCase()
  }

  /**
   * The default height of this map.
   * @returns {number}
   * @readonly
   */
  get defaultHeight () {
    return this._config.meta.defaultHeight
  }

  /**
   * The x and y limits of the map.
   * @returns {Vector2D}
   * @readonly
   */
  get worldLimits () {
    return Vector2D.fromObject(this._config.meta.worldLimits)
  }

  /**
   * The name of the map.
   * @returns {string}
   * @readonly
   */
  get mapName () {
    return this._config.meta.name
  }

  /**
   * The description of the map.
   * @returns {string}
   * @readonly
   */
  get description () {
    return this._config.meta.description
  }

  /**
   * The maximum amount of players allowed on this map.
   * @returns {number}
   * @readonly
   */
  get maxPlayers () {
    return this._config.meta.maxPlayers
  }

  /**
   * Gets player entity data.
   * @returns {PlayerConfig}
   * @readonly
   */
  get player () {
    return this._config.data.playerData
  }

  /**
   * Gets team data.
   * @returns {Array<Team>}
   * @readonly
   */
  get teams () {
    return this._config.meta.teams
  }

  /**
   * Gets graphics data.
   * @returns {Record<string, Graphic>}
   * @readonly
   */
  get graphics () {
    return this._config.data.graphicsData
  }

  /**
   * Gets modifiers data.
   * @returns {Record<string, Modifier>}
   * @readonly
   */
  get modifiers () {
    return this._config.data.modifiersData
  }
}
