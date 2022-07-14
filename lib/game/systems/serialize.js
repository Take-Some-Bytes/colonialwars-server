/* eslint-env node */
/**
 * @fileoverview Systems for serializing components.
 */

// Honestly, at this point I should probably use Typescript.

/**
 * @typedef {import('../../ecs/world')} World
 * @typedef {import('../../ecs/world').EntityType} EntityType
 *
 * @typedef {Object} Serialized
 * @prop {EntityType} entity
 * @prop {Record<string, any>} contents
 *
 * @typedef {Object} SerializeEntitiesOpts
 * @prop {World} world The ECS world the entities are in.
 * @prop {Record<string, SerializeFunc<any>>} serializers Serializers to use on
 * each entity's components.
 */
/**
 * @typedef {{ new (...args: any[]): T, properties: Array<string> }} ClassWithSchema
 * @template T
 */
/**
 * @callback SerializeFunc
 * @param {T} obj
 * @returns {Record<PropertyKey, any>}
 * @template T
 */

/**
 * Creates a new serializer function for the specified class.
 *
 * Returns a function that serializes instances of the class into a plain
 * object, with the properties specified on the class' static "properties"
 * getter.
 * @param {ClassWithSchema<T>} cls The class to create the serializer for.
 * @returns {SerializeFunc<T>}
 * @template T
 */
function createSerializer (cls) {
  if (!cls.properties || !Array.isArray(cls.properties)) {
    throw new Error('Static "properties" getter is required!')
  }

  /** @type {Array<string>} */
  const props = cls.properties.slice(0)

  return function serialize (obj) {
    if (!(obj instanceof cls)) {
      throw new TypeError(`Expected object to be instance of ${cls}!`)
    }

    return Object.fromEntries(props.map(prop => {
      return [prop, obj[prop]]
    }))
  }
}

/**
 * Serializes the components of the specified entities in plain object form
 * and returns an iterator that iterates over the serialized entities & components.
 * @param {IterableIterator<EntityType>} entities An iterator
 * of entities to serialize the components of.
 * @param {SerializeEntitiesOpts} opts Required options.
 * @returns {Generator<Serialized, void, void>}
 */
function * serializeEntities (entities, opts) {
  const { world, serializers } = opts

  for (const entity of entities) {
    const contents = Object.entries(serializers)
      .map(entry => {
        const [comp, serialize] = entry

        return serialize(world.getComponent(comp, { from: entity }))
      })
      .reduce((prev, curr) => ({ ...prev, ...curr }), {})

    yield {
      entity,
      contents
    }
  }
}

module.exports = {
  createSerializer,
  serializeEntities
}
