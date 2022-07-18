/* eslint-env jasmine */
/**
 * @fileoverview Specs for the World class, which stores all the entities and
 * components in the ECS architecture.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

import World from '../../lib/ecs/world.js'

describe('The World class,', () => {
  describe('when managing entities,', () => {
    it('should be able to create entities', () => {
      const world = new World()
      const entities = []

      for (let i = 0; i < 16; i++) {
        entities.push(world.create())
      }

      expect(world.numEntities).toBe(16)
      expect(entities.every(val => !!val)).toBeTrue()
      expect(entities.every(val => world.isValid(val))).toBeTrue()
    })

    it('should be able to return the number of entities', () => {
      const world = new World()
      const entities = []

      expect(world.numEntities).toBe(0)

      entities.push(world.create())

      expect(world.numEntities).toBe(1)

      entities.push(world.create())

      expect(world.numEntities).toBe(2)

      for (const entity of entities) {
        world.destroy(entity)
      }

      expect(world.numEntities).toBe(0)
    })

    it('should be able to delete entities', () => {
      const world = new World()
      const entity = world.create()

      expect(entity).toBeTruthy()
      expect(world.isValid(entity)).toBeTrue()

      world.destroy(entity)

      expect(world.isValid(entity)).toBeFalse()
    })

    it('should be able to create and delete entities repeatedly', () => {
      const world = new World()

      for (let i = 0; i < 16; i++) {
        const e1 = world.create()
        const e2 = world.create()

        expect(world.isValid(e1)).toBeTrue()
        expect(world.isValid(e2)).toBeTrue()

        world.destroy(e1)
        world.destroy(e2)

        expect(world.isValid(e1)).toBeFalse()
        expect(world.isValid(e2)).toBeFalse()
      }
    })

    it('should be able to clear all entities', () => {
      const world = new World()
      const entities = []

      for (let i = 0; i < 16; i++) {
        entities.push(world.create())
      }

      expect(world.numEntities).toBe(16)
      expect(entities.every(val => !!val)).toBeTrue()
      expect(entities.every(val => world.isValid(val))).toBeTrue()

      world.clear()

      expect(world.numEntities).toBe(0)
      expect(entities.every(val => world.isValid(val))).toBeFalse()
    })

    it('should be able to iterate over all valid entities', () => {
      const world = new World()
      const entities = []

      for (let i = 0; i < 16; i++) {
        entities.push(world.create())
      }

      world.destroy(entities[15])

      expect(world.numEntities).toBe(15)

      let idx = 0
      for (const entity of world.all()) {
        expect(entity).toBe(entities[idx])

        idx++
      }

      expect(idx).toBe(15)
    })
  })

  describe('when managing components,', () => {
    it('should be able to register new components', () => {
      class Component {}

      const world = new World()
      world.registerComponent('component', Component)

      expect(world.registeredComponents).toBe(1)
    })

    it('should be able to deregister components', () => {
      class Component {}

      const world = new World()
      world.registerComponent('component', Component)

      expect(world.registeredComponents).toBe(1)

      world.deregisterComponent('component')

      expect(world.registeredComponents).toBe(0)
    })

    it('should be able to add components to an entity', () => {
      class Component {}

      const world = new World()
      const entity = world.create()

      world.registerComponent('component', Component)

      expect(world.registeredComponents).toBe(1)
      expect(world.isValid(entity)).toBeTrue()

      world.addComponent('component', {
        to: entity,
        opts: {}
      })

      expect(world.allWith('component')).toContain(entity)
    })

    it('should be able to remove components from an entity', () => {
      class Component {}

      const world = new World()
      const entity = world.create()

      world.registerComponent('component', Component)

      expect(world.registeredComponents).toBe(1)
      expect(world.isValid(entity)).toBeTrue()

      world.addComponent('component', {
        to: entity,
        opts: {}
      })

      expect(world.allWith('component')).toContain(entity)

      world.removeComponent('component', {
        from: entity
      })

      expect(world.allWith('component')).not.toContain(entity)
    })

    it('should be able to get a single component of one type for an entity', () => {
      class Component {}

      const world = new World()
      const entity = world.create()

      world.registerComponent('component', Component)

      expect(world.registeredComponents).toBe(1)
      expect(world.isValid(entity)).toBeTrue()

      world.addComponent('component', {
        to: entity,
        opts: {}
      })

      expect(world.allWith('component')).toContain(entity)

      let got = world.getComponent('component', { from: entity })

      expect(got).not.toBeNull()
      expect(got).toBeInstanceOf(Component)

      world.removeComponent('component', { from: entity })

      got = world.getComponent('component', { from: entity })

      expect(got).toBeNull()
    })

    it('should be able to remove all of an entities components', () => {
      class Component1 {}
      class Component2 {}

      const world = new World()
      const entity = world.create()

      world.registerComponent('component1', Component1)
      world.registerComponent('component2', Component2)

      expect(world.registeredComponents).toBe(2)
      expect(world.isValid(entity)).toBeTrue()

      world.addComponent('component1', { to: entity, opts: {} })
      world.addComponent('component2', { to: entity, opts: {} })

      expect(world.allWith('component1')).toContain(entity)
      expect(world.allWith('component2')).toContain(entity)

      world.removeAllComponentsOf(entity)

      expect(world.allWith('component1')).not.toContain(entity)
      expect(world.allWith('component2')).not.toContain(entity)
    })

    it('should be able to iterate over all components of an entity', () => {
      class Component1 {}
      class Component2 {}

      const world = new World()
      const entity = world.create()

      world.registerComponent('component1', Component1)
      world.registerComponent('component2', Component2)

      expect(world.registeredComponents).toBe(2)
      expect(world.isValid(entity)).toBeTrue()

      world.addComponent('component1', { to: entity, opts: {} })
      world.addComponent('component2', { to: entity, opts: {} })

      const arr = Array.from(world.allComponentsOf(entity))

      expect(arr).toHaveSize(2)
      expect(arr[0]).toBeInstanceOf(Component1)
      expect(arr[1]).toBeInstanceOf(Component2)
    })

    it('should be able to iterate over all entities with a component', () => {
      class Component {}

      const world = new World()
      const entities = []

      world.registerComponent('component', Component)

      expect(world.registeredComponents).toBe(1)

      for (let i = 0; i < 8; i++) {
        const entity = world.create()

        world.addComponent('component', { to: entity, opts: {} })

        entities.push(entity)
      }

      expect(world.numEntities).toBe(8)

      let idx = 0
      for (const entity of world.allWith('component')) {
        expect(entities).toContain(entity)
        idx++
      }

      expect(idx).toBe(8)
    })

    it('should be able to iterate over all instances of a component', () => {
      class Component1 {}
      class Component2 {}

      const world = new World()

      world.registerComponent('component1', Component1)
      world.registerComponent('component2', Component2)

      const e1 = world.create()
      const e2 = world.create()
      const e3 = world.create()
      const e4 = world.create()

      world.addComponent('component1', { to: e1 })
      world.addComponent('component1', { to: e2 })
      world.addComponent('component1', { to: e3 })
      world.addComponent('component1', { to: e4 })

      world.addComponent('component2', { to: e1 })
      world.addComponent('component2', { to: e3 })

      const arr = Array.from(world.allInstancesOf('component2'))
      const ids = arr.map(entry => entry.entity)
      const comps = arr.map(entry => entry.component)

      expect(arr).toHaveSize(2)
      expect(ids).toHaveSize(2)
      expect(ids).toContain(e1)
      expect(ids).toContain(e3)
      expect(comps.every(comp => comp instanceof Component2)).toBeTrue()
    })
  })

  describe('when querying entities,', () => {
    it('should be able to get one entity', () => {
      // Not sure why you would do this, but we'll need it anyways.
      const world = new World()
      const entities = [world.create()]

      const res = world.query().one()

      expect(res).toBe(entities[0])
    })

    it('should be able to get all entities', () => {
      const world = new World()
      const entities = [
        world.create(),
        world.create(),
        world.create()
      ]

      const query = world.query().all()
      const arr = Array.from(query)

      expect(arr).toHaveSize(entities.length)
    })

    it('should be able to get all entities with a component', () => {
      class Component {}

      const world = new World()
      const entities = []

      world.registerComponent('component', Component)

      for (let i = 0; i < 3; i++) {
        if (i % 2 !== 0) {
          entities.push(world.create())
        } else {
          const entity = world.create()
          world.addComponent('component', { to: entity })

          entities.push(entity)
        }
      }

      const query = world.query().with('component').all()
      const res = Array.from(query)

      expect(res).toHaveSize(entities.length - 1)
      expect(res).not.toContain(entities[1])
    })

    it('should be able to get one entity with a component', () => {
      // Again, not sure why you would do this, but whatever.
      class Component {}

      const world = new World()
      const entities = []

      world.registerComponent('component', Component)

      for (let i = 0; i < 3; i++) {
        if (i % 2 !== 0) {
          entities.push(world.create())
        } else {
          const entity = world.create()
          world.addComponent('component', { to: entity })

          entities.push(entity)
        }
      }

      const res = world.query().with('component').one()

      expect(entities).toContain(res)
      expect(res).not.toBe(entities[1])
    })

    it('should be able to get all entities with many components', () => {
      class Component1 {}
      class Component2 {}

      const world = new World()

      world.registerComponent('component1', Component1)
      world.registerComponent('component2', Component2)

      const e1 = world.create()
      const e2 = world.create()
      const e3 = world.create()
      const e4 = world.create()

      world.addComponent('component1', { to: e1 })
      world.addComponent('component1', { to: e2 })
      world.addComponent('component1', { to: e3 })

      world.addComponent('component2', { to: e1 })
      world.addComponent('component2', { to: e3 })

      const query = world.query().with('component1').with('component2').all()
      const arr = Array.from(query)

      expect(arr).toHaveSize(2)
      expect(arr).toContain(e1)
      expect(arr).toContain(e3)
      expect(arr).not.toContain(e2)
      expect(arr).not.toContain(e4)
    })

    it('should be able to get one entity with many components', () => {
      class Component1 {}
      class Component2 {}

      const world = new World()

      world.registerComponent('component1', Component1)
      world.registerComponent('component2', Component2)

      const e1 = world.create()
      const e2 = world.create()
      const e3 = world.create()
      const e4 = world.create()

      world.addComponent('component1', { to: e1 })
      world.addComponent('component1', { to: e2 })
      world.addComponent('component1', { to: e3 })

      world.addComponent('component2', { to: e1 })
      world.addComponent('component2', { to: e3 })
      world.addComponent('component2', { to: e4 })

      const res = world.query().with('component1').with('component2').one()

      expect([e1, e3]).toContain(res)
      expect([e2, e4]).not.toContain(res)
    })

    it('should be able to get all entities without a component', () => {
      class Component {}

      const world = new World()
      const entities = [world.create()]

      world.registerComponent('component', Component)

      for (let i = 0; i < 3; i++) {
        const entity = world.create()
        world.addComponent('component', { to: entity })

        entities.push(entity)
      }

      entities.push(world.create())

      const query = world.query().without('component').all()
      const arr = Array.from(query)

      expect(arr).toHaveSize(2)
      expect(arr).toContain(entities[0])
      expect(arr).toContain(entities[4])
    })

    it('should be able to get one entity without a component', () => {
      class Component {}

      const world = new World()
      const entities = []

      world.registerComponent('component', Component)

      for (let i = 0; i < 3; i++) {
        if (i % 2 !== 0) {
          entities.push(world.create())
        } else {
          const entity = world.create()
          world.addComponent('component', { to: entity })

          entities.push(entity)
        }
      }

      const res = world.query().without('component').one()

      expect(entities).toContain(res)
      expect(res).toBe(entities[1])
    })

    it('should exclude components even if they only have one forbidden component', () => {
      class Component1 {}
      class Component2 {}

      const world = new World()

      world.registerComponent('component1', Component1)
      world.registerComponent('component2', Component2)

      const e1 = world.create()
      const e2 = world.create()
      const e3 = world.create()
      const e4 = world.create()

      world.addComponent('component1', { to: e1 })
      world.addComponent('component1', { to: e2 })
      world.addComponent('component1', { to: e3 })

      world.addComponent('component2', { to: e1 })
      world.addComponent('component2', { to: e3 })

      const query = world.query().without('component1').without('component2').all()
      const arr = Array.from(query)

      expect(arr).toHaveSize(1)
      expect(arr).toContain(e4)
      expect(arr).not.toContain(e1)
      expect(arr).not.toContain(e2)
      expect(arr).not.toContain(e3)
    })

    it('should be able to run a custom find function', () => {
      class Component1 {}
      class Component2 {}

      const world = new World()

      world.registerComponent('component1', Component1)
      world.registerComponent('component2', Component2)

      const e1 = world.create()
      const e2 = world.create()
      const e3 = world.create()
      const e4 = world.create()

      world.addComponent('component1', { to: e1 })
      world.addComponent('component1', { to: e2 })
      world.addComponent('component1', { to: e3 })

      world.addComponent('component2', { to: e1 })
      world.addComponent('component2', { to: e3 })
      world.addComponent('component2', { to: e4 })

      const query = world.query().find(e => e === e2).all()
      const arr = Array.from(query)

      expect(arr).toHaveSize(1)
      expect(arr[0]).toBe(e2)

      const res = world.query().find(e => e === e2).one()

      expect(res).toBe(e2)
    })

    it('should be able to execute complex queries', () => {
      class Component1 {}
      class Component2 {}

      const world = new World()

      world.registerComponent('component1', Component1)
      world.registerComponent('component2', Component2)

      const e1 = world.create()
      const e2 = world.create()
      const e3 = world.create()
      const e4 = world.create()

      world.addComponent('component1', { to: e1 })
      world.addComponent('component1', { to: e2 })
      world.addComponent('component1', { to: e3 })

      world.addComponent('component2', { to: e1 })
      world.addComponent('component2', { to: e2 })
      world.addComponent('component2', { to: e4 })

      const res = world.query().with('component1').without('component2').find(e => e === e3).one()
      expect(res).toBe(e3)
    })

    it('should throw an error if constraints are repeated', () => {
      class Component {}

      const world = new World()

      world.registerComponent('component', Component)

      expect(() => {
        return world.query().with('component').without('component')
      }).toThrowError('Component is already included!')
      expect(() => {
        return world.query().without('component').with('component')
      }).toThrowError('Component is already excluded!')
    })

    it('should throw an error if custom find function is set more than once', () => {
      class Component {}

      const world = new World()

      world.registerComponent('component', Component)

      expect(() => {
        return world.query().find(e => !!e).find(e => !!e)
      }).toThrowError('Finder is already set!')
    })
  })
})
