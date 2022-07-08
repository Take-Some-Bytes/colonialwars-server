/* eslint-env node */
/**
 * @fileoverview The World where all the entities and components are stored.
 */

const { Uint32ArrUtils } = require('../utils/array-utils')
const SparseSet = require('./sparse-set')

/**
 * @typedef {number} EntityType
 *
 * @typedef {Object} AddComponentOpts
 * @prop {EntityType} to The entity to add the component to.
 * @prop {any} opts Options for constructing the component.
 *
 * @typedef {Object} RmvComponentOpts
 * @prop {EntityType} from The entity to remove the component from.
 *
 * @typedef {Object} GetComponentOpts
 * @prop {EntityType} from The entity to get the component from.
 */
/**
 * @typedef {Object} ComponentEntry
 * @prop {EntityType} entity
 * @prop {T} component
 * @template T
 */
/**
 * @typedef {Object} ComponentRegistryEntry
 * @prop {SparseSet<ComponentEntry<T>>} current
 * @prop {new (opts: any) => T} constructor
 * @template T
 */

/**
 * An object with functions that relate to entities and their IDs.
 *
 * The structure of an entity ID:
 *
 * ```none
 *            Entity ID: 32 bits
 *                    |
 * +------------------+------------------+
 * |                  |                  |
 * | Version: 12 bits |  Index: 20 bits  |
 * |                  |                  |
 * +------------------+------------------+
 * ```
 */
const Entity = {
  /* eslint-disable-next-line key-spacing */
  IDX_MASK:     0b00000000000011111111111111111111,
  VERSION_MASK: 0b11111111111100000000000000000000,
  VERSION_OFFSET: 20,

  /**
   * Creates an entity ID from a version and index.
   * @param {{ version: number, idx: number }} opts Creation options.
   * @returns {number}
   */
  from: opts => {
    const { version, idx } = opts
    const actualVersion = version << Entity.VERSION_OFFSET

    if ((idx & Entity.IDX_MASK) !== idx) {
      throw new RangeError('Index out of range!')
    }
    if ((actualVersion & Entity.VERSION_MASK) !== actualVersion) {
      throw new RangeError('Version out of range!')
    }

    return actualVersion + idx
  },

  /**
   * Gets the index of the specified entity.
   * @param {number} entity The entity ID.
   * @returns {number}
   */
  getIndex: entity => {
    return entity & Entity.IDX_MASK
  },

  /**
   * Gets the version of the specified entity.
   * @param {number} entity The entity ID.
   * @returns {number}
   */
  getVersion: entity => {
    return entity >> Entity.VERSION_OFFSET
  }
}

/**
 * The World where all the entities and components are stored.
 */
class World {
  /**
   * Creates a new World object.
   *
   * A world sits at the core of the Entity-Component-System architecture. It
   * handles the creation, deletion, and modification of all entities and components
   * that exist in it.
   */
  constructor () {
    /**
     * An array of all the valid and invalid entities in this world.
     * @type {Array<EntityType>}
     * @private
     */
    this._entities = []
    /**
     * A map of all the registered components and the entities that possess
     * them.
     * @type {Map<string, ComponentRegistryEntry<unknown>>}
     * @private
     */
    this._components = new Map()
    /**
     * The number of entities ready to be recycled.
     * @private
     */
    this._available = 0
    /**
     * The index of the next entity to be recycled.
     * @type {number}
     * @private
     */
    this._next = Uint32ArrUtils.MAX_UINT32
  }

  /// ============= PRIVATE ============== ///

  /**
   * Gets the next available entity index.
   * @returns {number}
   * @private
   */
  _getNextIdx () {
    if (this._available > 0) {
      const nextIdx = Entity.getIndex(this._next)

      this._next = Entity.getIndex(this._entities[nextIdx])
      this._available--

      return nextIdx
    }

    return this._entities.length
  }

  /// /// ============= PUBLIC ============== /// ///

  /**
   * The number of current valid entities.
   */
  get numEntities () {
    return this._entities.length - this._available
  }

  /**
   * The number of registered components.
   */
  get registeredComponents () {
    return this._components.size
  }

  // Entities //

  /**
   * Creates a new entity and returns its ID.
   * @returns {EntityType}
   */
  create () {
    const idx = this._getNextIdx()

    if (idx < this._entities.length) {
      const version = Entity.getVersion(this._entities[idx])
      const entity = Entity.from({ version, idx })
      this._entities[idx] = entity

      return entity
    }

    const entity = Entity.from({ version: 1, idx })
    this._entities.push(entity)

    return entity
  }

  /**
   * Tests if the given entity is valid.
   * @param {EntityType} toTest The entity to test.
   * @returns {boolean}
   */
  isValid (toTest) {
    const idx = Entity.getIndex(toTest)
    if (idx >= this._entities.length) {
      return false
    }

    const entity = this._entities[idx]

    return toTest === entity
  }

  /**
   * Destroys the specified entity and all its associated components. Returns
   * true if deletion was successful.
   * @param {EntityType} entity The entity to delete.
   * @returns {boolean}
   */
  destroy (entity) {
    const idx = Entity.getIndex(entity)
    const version = Entity.getVersion(entity)
    if (idx >= this._entities.length) {
      return false
    }

    this.removeAllComponentsOf(entity)

    this._entities[idx] = Entity.from({
      idx: Entity.getIndex(this._next),
      version: version + 1
    })
    this._next = idx
    this._available++

    return true
  }

  /**
   * Removes all entities from this world.
   */
  clear () {
    for (const entity of this.all()) {
      this.destroy(entity)
    }
  }

  // Components //

  /**
   * Registers a class as a recognized component. Throws if a component with the
   * same name already exists.
   * @param {string} name A name to refer to the component.
   * @param {new (opts: any) => T} componentClass The component's class.
   * @template T
   */
  registerComponent (name, componentClass) {
    if (this._components.has(name)) {
      throw new Error('Component already exists!')
    }
    if (!isConstructor(componentClass)) {
      throw new TypeError('Componet class must to constructable!')
    }

    this._components.set(name, {
      constructor: componentClass,
      current: new SparseSet()
    })
  }

  /**
   * Deregisters a registered component. Throws if the component does not exist,
   * or if there are still entities using the component.
   * @param {string} name The name of the component.
   */
  deregisterComponent (name) {
    if (!this._components.has(name)) {
      throw new Error('Component does not exist!')
    }

    const component = this._components.get(name)
    if (component.current.length !== 0) {
      throw new Error('Entities are still using this component!')
    }

    this._components.delete(name)
  }

  /**
   * Modifies a component of the specified entity, with the specified initialization
   * options. Creates an entry if the component does not exist for the specified
   * entity. Throws an error if the component does not exist.
   * @param {string} name The name of the component.
   * @param {AddComponentOpts} opts Specify component options and which entity
   * to add the component to.
   */
  addComponent (name, opts) {
    const entity = opts.to

    if (!this._components.has(name)) {
      throw new Error('Component does not exist!')
    }
    if (!this.isValid(entity)) {
      throw new Error('Invalid entity!')
    }

    const component = this._components.get(name)

    /**
     * XXX: ALWAYS use entity index to add components to entities.
     * This is to prevent unnecessary allocations, because an entity ID and its
     * version combined is HUGE.
     * (07/06/2022) Take-Some-Bytes */
    component.current.insert(Entity.getIndex(entity), {
      entity,
      component: new component.constructor(opts.opts)
    })
  }

  /**
   * Gets the specified component associated with the specified entity, or null
   * if the entity does not have the component.
   * @param {string} name The name of the component.
   * @param {GetComponentOpts} opts Specify which entity to get the component
   * from.
   * @returns {any|null}
   */
  getComponent (name, opts) {
    const entity = opts.from

    if (!this._components.has(name)) {
      throw new Error('Component does not exist!')
    }
    if (!this.isValid(entity)) {
      throw new Error('Invalid entity!')
    }

    /**
     * XXX: See ``addComponents()`` method.
     * (07/06/2022) Take-Some-Bytes */
    const entry = this._components
      .get(name)
      .current
      .get(Entity.getIndex(entity))

    return entry ? entry.component : null
  }

  /**
   * Removes the specified component from the specified entity. Returns true
   * if removed successfully, false otherwise.
   * @param {string} name The name of the component.
   * @param {RmvComponentOpts} opts Specify which entity to remove the component
   * from.
   * @returns {boolean}
   */
  removeComponent (name, opts) {
    const entity = opts.from

    if (!this._components.has(name)) {
      throw new Error('Component does not exist!')
    }
    if (!this.isValid(entity)) {
      throw new Error('Invalid entity!')
    }

    /**
     * XXX: See ``addComponents()`` method.
     * (07/06/2022) Take-Some-Bytes */
    return !!this._components
      .get(name)
      .current
      .delete(Entity.getIndex(entity))
  }

  /**
   * Removes all components from an entity.
   * @param {EntityType} entity The entity to remove all components from.
   */
  removeAllComponentsOf (entity) {
    /**
     * XXX: See ``addComponents()`` method.
     * (07/06/2022) Take-Some-Bytes */
    const idx = Entity.getIndex(entity)

    if (!this.isValid(entity)) {
      throw new Error('Invalid entity!')
    }

    for (const entry of this._components.values()) {
      entry.current.delete(idx)
    }
  }

  // Generators //

  /**
   * Returns an iterator that iterates over all currently valid entities.
   * @returns {Generator<EntityType, void, void>}
   */
  * all () {
    for (let i = 0; i < this._entities.length; i++) {
      const entity = this._entities[i]
      const idx = Entity.getIndex(entity)

      if (idx === i) {
        yield entity
      }
    }
  }

  /**
   * Returns an iterator that iterates over all entities with the specified component.
   * @param {string} name The name of the component.
   * @returns {Generator<EntityType, void, void>}
   */
  * allWith (name) {
    if (!this._components.has(name)) {
      throw new Error('Component does not exist!')
    }

    for (const entry of this._components.get(name).current.values()) {
      yield entry.entity
    }
  }

  /**
   * Returns an iterator that iterates over all the components of the specified entity.
   * @param {EntityType} entity The entity to iterate the components of.
   * @returns {Generator<any, void, void>}
   */
  * allComponentsOf (entity) {
    /**
     * XXX: See ``addComponents()`` method.
     * (07/06/2022) Take-Some-Bytes */
    const idx = Entity.getIndex(entity)

    if (!this.isValid(entity)) {
      throw new Error('Invalid entity!')
    }

    for (const componentEntry of this._components.values()) {
      if (componentEntry.current.has(idx)) {
        yield componentEntry.current.get(idx).component
      }
    }
  }
}

/**
 * Returns true if ``f`` can be called as a constructor.
 * @param {any} f The function to test.
 * @returns {boolean}
 */
function isConstructor (f) {
  try {
    Reflect.construct(String, [], f)
  } catch (e) {
    return false
  }
  return true
}

module.exports = World
