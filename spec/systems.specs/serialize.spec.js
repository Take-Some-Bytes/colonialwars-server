/* eslint-env jasmine */
/**
 * @fileoverview Specs for systems that handle the serialization of world entities.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

import World from 'colonialwars-lib/ecs'

import * as SerializeSystems from '../../lib/game/systems/serialize.js'

/**
 * Creates a mock component for a spec.
 */
function createMockComponent () {
  return class {
    constructor (opts) {
      this.opts = opts
    }
  }
}

/**
 * Sets up a world and serializers for serialize specs.
 * @returns {[World, Record<string, SerializeSystems.SerializeFunc<any>>]}
 */
function setUpForSerialize () {
  class HasProperties {
    static get properties () {
      return ['test', 'otherTest']
    }

    constructor (opts) {
      this.test = opts.test
      this.otherTest = opts.otherTest

      this.private = "Don't serialize this."
    }
  }
  class MoreProperties {
    static get properties () {
      return ['notPosition']
    }

    constructor (opts) {
      this.notPosition = { x: opts.notPosition.y, y: opts.notPosition.x }

      this.notNotPrivate = 'Please do not not serialize this'
    }
  }
  const NoSerialize = createMockComponent()

  const world = new World()
  const serializers = {
    hasProps: SerializeSystems.createSerializer(HasProperties),
    moreProps: SerializeSystems.createSerializer(MoreProperties)
  }

  world.registerComponent('noSerialize', NoSerialize)
  world.registerComponent('hasProps', HasProperties)
  world.registerComponent('moreProps', MoreProperties)

  return [world, serializers]
}

describe('The createSerializer() utility function,', () => {
  it('should require a static "properties" getter for components', () => {
    const NoProperties = createMockComponent()

    expect(() => {
      SerializeSystems.createSerializer(NoProperties)
    }).toThrowError(/^.*static "properties" getter is required.*$/gi)
  })

  it('should be able to serialize desired properties', () => {
    class HasProperties {
      static get properties () {
        return ['test', 'otherTest']
      }

      constructor (test, otherTest) {
        this.test = test
        this.otherTest = otherTest

        this.private = "Don't serialize this."
      }
    }

    const serialize = SerializeSystems.createSerializer(HasProperties)
    const instance = new HasProperties(100, null)

    const ret = serialize(instance)

    expect(ret.test).toBe(100)
    expect(ret.otherTest).toBeNull()
    expect(ret.private).toBeUndefined()
  })
})

describe('The serializeEntities() system,', () => {
  it('should take an iterator of entities to serialize', () => {
    expect(() => {
      SerializeSystems.serializeEntities(null, null).next()
    }).toThrowError(TypeError)
  })

  it('should be able to serialize desired components', () => {
    const [world, serializers] = setUpForSerialize()
    const entity = world.create()

    world.addComponent('hasProps', {
      to: entity,
      opts: { test: Number.MAX_SAFE_INTEGER, otherTest: 'please serialize' }
    })
    world.addComponent('moreProps', {
      to: entity,
      opts: { notPosition: { x: 80, y: 120 } }
    })
    world.addComponent('noSerialize', {
      to: entity,
      opts: { moreOpts: true }
    })

    const ret = Array.from(
      SerializeSystems.serializeEntities(world.all(), { world, serializers })
    )
    expect(ret).toHaveSize(1)

    const [serialized] = ret
    const actual = serialized.contents

    expect(actual.test).toBe(Number.MAX_SAFE_INTEGER)
    expect(actual.otherTest).toMatch(/^please serialize$/i)
    expect(actual.notPosition).toEqual({
      // The props are swapped (see the constructor of MoreProperties)
      x: 120,
      y: 80
    })
    expect(actual.opts).toBeUndefined()
  })
})
