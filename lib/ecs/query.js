/* eslint-env node */
/**
 * @fileoverview Query ECS worlds.
 */

const assert = require('assert')
const debug = require('debug')('ecs:query')

const SparseSet = require('./sparse-set')

/**
 * @typedef {import('./world').EntityType} EntityType
 */

/**
 * @callback FinderFunc
 * @param {EntityType} entity
 * @returns {boolean}
 */

/**
 * An object representing a query on an ECS world.
 *
 * Allows for filtering entities based on components and applying a custom
 * filter function.
 */
class WorldQuery {
  /**
   * Creates a new query for an ECS world.
   *
   * Allows for filtering entities based on components and applying a custom
   * filter function.
   * @param {import('./world')} world The world the query is going to be
   * executed in.
   */
  constructor (world) {
    this.world = world

    /**
     * @type {Array<string>}
     * @private
     */
    this._required = []
    /**
     * @type {Array<string>}
     * @private
     */
    this._forbidden = []
    /**
     * @type {FinderFunc}
     * @private
     */
    this._finder = null
  }

  /**
   * Requires entities to have the specified component.
   * @param {string} component The name of the component.
   * @returns {this}
   */
  with (component) {
    if (this._forbidden.includes(component)) {
      throw new Error('Component is already excluded!')
    }
    if (this._required.includes(component)) {
      // no-op
      debug('Component "%s" already required', component)
      return
    }

    this._required.push(component)

    debug('Component "%s" added to required', component)

    return this
  }

  /**
   * Requires entities to *not* have the specified component.
   * @param {string} component The name of the component.
   * @returns {this}
   */
  without (component) {
    if (this._required.includes(component)) {
      throw new Error('Component is already included!')
    }
    if (this._forbidden.includes(component)) {
      // no-op
      debug('Component "%s" already forbidden', component)
      return
    }

    this._forbidden.push(component)

    debug('Component "%s" added to forbidden', component)

    return this
  }

  /**
   * Set a custom finder function that will be applied after with/without.
   * @param {FinderFunc} func The name of the component.
   * @returns {this}
   */
  find (func) {
    if (this._finder) {
      throw new Error('Finder is already set!')
    }

    this._finder = func

    debug('Finder function set')

    return this
  }

  /**
   * Gets *one* entity that matches the specified criteria.
   * @returns {EntityType|null}
   */
  one () {
    return this.all().next().value || null
  }

  /**
   * Get an iterator over all the entities that match the specified criteria.
   * @returns {Generator<EntityType, void, void>}
   */
  * all () {
    const requiredLen = this._required.length
    const forbiddenLen = this._forbidden.length
    const hasFinder = !!this._finder

    if (!requiredLen && !forbiddenLen && !hasFinder) {
      debug('No constraints; yielding all')
      yield * this.world.all()
      return
    }
    if (!requiredLen && !forbiddenLen) {
      debug('Applying finder only')

      for (const entity of this.world.all()) {
        if (this._finder(entity)) {
          yield entity
        }
      }
      return
    }
    if (!requiredLen) {
      debug('No required components; forbidden components are: %o', this._forbidden)

      const finder = this._finder || (() => true)
      const forbidden = this._forbidden

      // No required components, but we do have forbidden components.
      // Most efficient way to go about this is to walk through all entities
      // and test if they have forbidden components or not.
      for (const entity of this.world.all()) {
        // hasForbidden fails if the entity has even *one* forbidden component,
        // so we use logical OR (||)
        const hasForbidden = forbidden
          .map(name => this.world.getComponent(name, { from: entity }))
          .map(comp => !!comp)
          .reduce((prev, curr) => prev || curr, false)

        if (!hasForbidden && finder(entity)) {
          yield entity
        }
      }

      return
    }

    debug('Assuming required and forbidden components are both present')

    // We have required and (possibly) forbidden components.
    // Most efficient way to go about this is to get the component which has the
    // *least* entities assigned, then yield entities which have the required
    // components and don't have the forbidden components.
    const shortest = (() => {
      let shortest = {
        name: null,
        set: null
      }

      for (const required of this._required) {
        const set = this.world._components.get(required).current

        if (!shortest.set || set.length < shortest.set.length) {
          shortest = {
            name: required,
            set
          }
        }
      }

      return shortest
    })()

    debug('Component "%s" has the least entities assigned', shortest.name)

    assert(shortest.set instanceof SparseSet)

    const finder = this._finder || (() => true)
    const forbidden = this._forbidden
    // Remove the component set we're iterating right now from the required ones.
    const required = this._required.slice()
    required.splice(required.indexOf(shortest.name), 1)

    for (const entry of shortest.set.values()) {
      const entity = entry.entity

      // hasForbidden fails if the entity has even *one* forbidden component,
      // so we use logical OR (||)
      const hasForbidden = forbidden
        .map(name => this.world.getComponent(name, { from: entity }))
        .map(comp => !!comp)
        .reduce((prev, curr) => prev || curr, false)

      // hasRequired needs an entity to have ALL components, so we use logical AND (&&)
      const hasRequired = required
        .map(name => this.world.getComponent(name, { from: entity }))
        .map(comp => !!comp)
        .reduce((prev, curr) => prev && curr, true)

      if (!hasRequired || hasForbidden || !finder(entity)) {
        continue
      }

      yield entity
    }
  }
}

module.exports = WorldQuery
