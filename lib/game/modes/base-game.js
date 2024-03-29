/* eslint-env node */
/**
 * @fileoverview BaseGame class for basic functionality that all game modes need.
 */

import events from 'events'

import debugFactory from 'debug'

import World from 'colonialwars-lib/ecs'
import PlayerComponent from '../components/player.js'
import * as PhysicsComponents from '../components/physics.js'
import * as PlayerSystems from '../systems/player.js'
import * as SerializeSystems from '../systems/serialize.js'

import { Vector2D } from 'colonialwars-lib/math'

const debug = debugFactory('colonialwars:basegame')

const COMPONENT_MAP = {
  physicalProps: PhysicsComponents.PhysicalProps,
  transform2d: PhysicsComponents.Transform2d,
  velocity2d: PhysicsComponents.Velocity2d,
  player: PlayerComponent
}

/**
 * @typedef {import('colonialwars-lib/cwdtp').WSConn<string>} WSConnInstance
 * @typedef {import('../components/player').PlayerInput} PlayerInput
 *
 * @typedef {Omit<PlayerInput, 'timestamp'>} RawPlayerInput
 *
 * @typedef {Object} Communications
 * @prop {string} CONN_UPDATE
 * @prop {string} CONN_REMOVE_PLAYER
 *
 * @typedef {Object} BaseGameConfig
 * @prop {string} id
 * @prop {number} stepsPerUpdate
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
 *
 * @typedef {Object} SerializedState
 * @prop {string} id The ID of the player.
 * @prop {string} contents The actual serialized state.
 */

/**
 * BaseGame class.
 * @extends events.EventEmitter
 */
export default class BaseGame extends events.EventEmitter {
  /**
   * Constructor for a BaseGame class.
   * @param {BaseGameConfig} config Configurations.
   */
  constructor (config) {
    const {
      id, mapConfig, stepsPerUpdate
    } = config

    super()

    this.id = id
    this.mapConfig = mapConfig
    this.stepsPerUpdate = stepsPerUpdate || 1
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
     * The ECS world where all the entities are going to live.
     * @private
     */
    this._world = new World()
    this._worldInitialized = false

    /**
     * @type {Record<string, import('../systems/serialize').SerializeFunc<any>>}
     * @private
     */
    this._serializers = {}
    this._serializersInitialized = false

    this.currentPlayers = 0
    this.lastUpdateTime = 0
    /**
     * This property could be used to mark the current game as "closed", meaning
     * that no players could join the game, even if there is still enough space
     * left in the game.
     */
    this.closed = false
    this.full = false
    this.stepCount = 0
  }

  /**
   * Returns true if this game is currently accepting new players.
   * @returns {boolean}
   */
  get acceptingPlayers () {
    return !(this.closed || this.full)
  }

  // ============ Private initialization ============ //

  /**
   * Initializes the ECS world. Can only be called once.
   * @private
   */
  _initWorld () {
    if (this._worldInitialized) {
      return
    }

    Object.entries(COMPONENT_MAP).forEach(([name, comp]) => {
      this._world.registerComponent(name, comp)
    })

    this._worldInitialized = true
  }

  /**
   * Initializes the component serializers used by the serializeState() method.
   * @private
   */
  _initSerializers () {
    if (this._serializersInitialized) {
      return
    }

    Object.entries(COMPONENT_MAP).forEach(([name, comp]) => {
      this._serializers[name] = SerializeSystems.createSerializer(comp)
    })

    this._serializersInitialized = true
  }

  // ============ Private bookkeeping ============ //

  /**
   * Handles internal bookkeeping of removing a player.
   *
   * Returns the name of the removed player.
   * @param {import('../../ecs/world').EntityType} entity The entity ID of the player.
   * @param {PlayerComponent} info Player information.
   * @returns {string}
   * @private
   */
  _removePlayer (entity, info) {
    this._world.destroy(entity)

    debug('Removed player %s from game %s', info.id, this.id)

    this.currentPlayers--
    this.teams.get(info.team).currentPlayers--

    if (this.currentPlayers < this.maxPlayers) {
      this.full = false
      this.emit('capacity-change', {
        full: false,
        currentPlayers: this.currentPlayers,
        maxPlayers: this.maxPlayers
      })
    }

    return info.name
  }

  // ============ Public initialization ============ //

  /**
   * Initializes the game state.
   */
  init () {
    this.lastUpdateTime = Date.now()
    this.currentPlayers = 0
    this.full = false

    this._initWorld()
    this._initSerializers()

    this._world.clear()
  }

  // ============ Public player manipulation ============ //

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
    this.currentPlayers++

    PlayerSystems.addPlayerTo(this._world, {
      id,
      name: meta.name,
      team: meta.team,
      position: team.spawnPosition.copy(),
      speed: this.mapConfig.player.speed,
      /**
       * TODO: Add configuration option for player mass.
       * (07/14/2022) Take-Some-Bytes */
      mass: 2
    })

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
   * Removes the specified player from this BaseGame, and returns the name of
   * the player that was removed.
   * @param {string} id The ID associated with the player.
   * @returns {string|null}
   */
  removePlayer (id) {
    const entity = this._world.query().with('player').find(e => {
      const info = this._world.getComponent('player', { from: e })

      return info.id === id
    }).one()

    if (!entity) {
      return null
    }

    return this._removePlayer(entity, this._world.getComponent(
      'player', { from: entity }
    ))
  }

  /**
   * Clears all players currently in this BaseGame.
   */
  clearPlayers () {
    // Generators are lazy, and deleting things is a mutable operation.
    const entries = Array.from(this._world.allInstancesOf('player'))

    for (const entry of entries) {
      this._removePlayer(entry.entity, entry.component)
    }
  }

  /**
   * Gets the player name associated with the ID, or null if there is
   * no player associated with the ID.
   * @param {string} id The ID associated with the player.
   * @returns {string|null}
   */
  getPlayerNameByID (id) {
    const entity = this._world.query()
      .with('player')
      .find(e => {
        const info = this._world.getComponent('player', { from: e })

        return info.id === id
      })
      .one()

    if (!entity) {
      return null
    }

    return this._world.getComponent('player', { from: entity }).name
  }

  /**
   * Gets an iterator over the names of all the players in thsi game.
   * @returns {Generator<string, void, void>}
   */
  * allPlayerNames () {
    for (const { component: info } of this._world.allInstancesOf('player')) {
      yield info.name
    }
  }

  // ============ Public input managment ============ //

  /**
   * Adds an input to the input queue of the specified player.
   * @param {string} id The ID of the player to add the input to.
   * @param {RawPlayerInput} input The input to add to the player.
   */
  addInputTo (id, input) {
    const playerEntity = this._world.query().with('player').find(e => {
      const info = this._world.getComponent('player', { from: e })

      return info.id === id
    }).one()

    if (!this._world.isValid(playerEntity)) {
      throw new Error('Player does not exist!')
    }

    const queue = this._world.getComponent('player', { from: playerEntity }).inputQueue

    queue.push({
      ...input,
      timestamp: Date.now()
    })
  }

  // ============ Private update ============ //

  /**
   * Private pre-step work.
   * @private
   */
  _preStep () {
    this.stepCount++
  }

  /**
   * Private step.
   * @param {number} lastUpdateTime The time of the last update.
   * @param {number} deltaTime The time passed since the last update.
   * @private
   */
  _step (lastUpdateTime, deltaTime) {
    const currentTime = lastUpdateTime + deltaTime

    PlayerSystems.processInputs(this._world, {
      currentTime,
      worldLimits: this.mapConfig.worldLimits
    })
  }

  /**
   * Private post-step.
   * @private
   */
  _postStep () {}

  // ============ Public update ============ //

  /**
   * Updates the game state.
   *
   * An update is made up of one or more steps. The number of steps run per update
   * is determined via the ``game.stepsPerUpdate`` property. The step hook is passed
   * a delta which represents the time passed since the last step.
   *
   * This method does things in the following order.
   *  - ``_preStep()``: private pre-step.
   *  - ``preStep()``: custom, overridable pre-step.
   *  - ``_step()``: private step; handles input & physics.
   *  - ``step()``: custom, overridable step.
   *  - ``postStep()``: custom, overridable post-step.
   *  - ``_postStep()``: private post-step.
   *
   * The above is repeated as many times as necessary.
   */
  update () {
    const currentTime = Date.now()
    const deltaTime = currentTime - this.lastUpdateTime
    const dtPerStep = deltaTime / this.stepsPerUpdate

    for (let i = 0; i < this.stepsPerUpdate; i++) {
      this.emit('preStep')
      this._preStep()
      this.preStep()

      this.emit('step', { stepCount: this.stepCount })
      this._step(this.lastUpdateTime, dtPerStep)
      this.step(this.lastUpdateTime, dtPerStep)

      this.emit('postStep')
      this.postStep()
      this._postStep()

      this.lastUpdateTime += dtPerStep
    }
  }

  /**
   * Custom, overridable pre-step hook.
   *
   * Override this method to perform work that executes before the main game step.
   * @abstract
   */
  preStep () {}

  /**
   * Custom, overridable step hook.
   *
   * Override this method to perform work that executes during the main game step,
   * but after the built-in step has executed
   *
   * @param {number} lastUpdateTime The time of the last update.
   * @param {number} deltaTime The time passed since the last update.
   * @abstract
   */
  step (lastUpdateTime, deltaTime) {}

  /**
   * Custom, overridable post-step hook.
   *
   * Override this method to perform work that executes immediately after the main
   * game step, but before the built-in post-step has executed.
   * @abstract
   */
  postStep () {}

  // ============ Public state serialization ============ //

  /**
   * Returns an iterator that iterates over the serialized states for all the
   * players.
   * @returns {Generator<SerializedState, void, void>}
   */
  * serializeState () {
    const world = this._world
    const serializers = this._serializers
    const playerEntities = this._world.allWith('player')

    // This only serializes the players right now.
    const serialized = SerializeSystems.serializeEntities(
      playerEntities, { world, serializers }
    )

    for (const item of serialized) {
      yield {
        id: this._world.getComponent('player', { from: item.entity }).id,
        contents: {
          self: item.contents
        }
      }
    }
  }
}
