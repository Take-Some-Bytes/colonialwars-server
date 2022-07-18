/* eslint-env jasmine */
/**
 * @fileoverview Specs for player systems.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

import Vector2D from '../../lib/game/physics/vector2d.js'
import World from '../../lib/ecs/world.js'
import Player from '../../lib/game/components/player.js'
import * as PhysicsComponents from '../../lib/game/components/physics.js'

import * as PlayerSystems from '../../lib/game/systems/player.js'

const TEST_PLAYERS = [
  {
    name: 'GENERAL LOUDSPEAKER',
    team: 'one',
    speed: 1,
    mass: 1,
    position: { x: 0, y: 0 }
  },
  {
    name: 'THISISTHEPOLICE',
    team: 'two',
    speed: 1,
    mass: 1,
    position: { x: 0, y: 0 }
  },
  {
    name: 'socialsecurity',
    team: 'one',
    speed: 1,
    mass: 1,
    position: { x: 0, y: 0 }
  },
  {
    name: 'FBIOPENUP',
    team: 'two',
    speed: 1,
    mass: 1,
    position: { x: 0, y: 0 }
  }
]

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
 * Sets a world up for input specs.
 * @returns {World}
 */
function setUpForInput () {
  const world = new World()

  world.registerComponent('physicalProps', PhysicsComponents.PhysicalProps)
  world.registerComponent('transform2d', PhysicsComponents.Transform2d)
  world.registerComponent('velocity2d', PhysicsComponents.Velocity2d)
  world.registerComponent('player', Player)

  return world
}

describe('The player systems,', () => {
  it('should be able to add an entity with player components', () => {
    const MockPhysicalProps = createMockComponent()
    const MockTransform2d = createMockComponent()
    const MockVelocity2d = createMockComponent()
    const MockPlayer = createMockComponent()

    const world = new World()

    world.registerComponent('physicalProps', MockPhysicalProps)
    world.registerComponent('transform2d', MockTransform2d)
    world.registerComponent('velocity2d', MockVelocity2d)
    world.registerComponent('player', MockPlayer)

    PlayerSystems.addPlayerTo(world, {
      id: '1',
      name: 'no',
      team: 'teal',
      speed: 2,
      mass: 2,
      position: { x: 0, y: 0 }
    })

    const playerEntity = world.query().with('player').find(e => {
      const info = world.getComponent('player', { from: e })

      return info.opts.id === '1'
    }).one()

    expect(playerEntity).toBeTruthy()
    expect(world.isValid(playerEntity)).toBeTrue()

    const comps = Array.from(world.allComponentsOf(playerEntity))

    expect(comps).toHaveSize(4)

    comps.forEach(comp => {
      const isPhysicalProps = comp instanceof MockPhysicalProps
      const isTransform2d = comp instanceof MockTransform2d
      const isVelocity2d = comp instanceof MockVelocity2d
      const isPlayer = comp instanceof MockPlayer

      expect(isPhysicalProps || isTransform2d || isVelocity2d || isPlayer).toBeTrue()

      if (isPhysicalProps) {
        expect(comp.opts).toEqual({
          speed: 2,
          mass: 2
        })
      }
      if (isTransform2d) {
        expect(comp.opts).toEqual({
          position: { x: 0, y: 0 }
        })
      }
      if (isVelocity2d) {
        expect(comp.opts).toBeUndefined()
      }
      if (isPlayer) {
        expect(comp.opts).toEqual({
          id: '1',
          name: 'no',
          team: 'teal'
        })
      }
    })
  })

  describe('when processing inputs,', () => {
    it('should keep doing last action if no inputs are received', () => {
      const world = setUpForInput()
      const players = TEST_PLAYERS.slice(2)

      players.forEach((player, i) => PlayerSystems.addPlayerTo(world, {
        ...player,
        id: i
      }))

      expect(world.numEntities).toBe(2)

      // Change velocities of the players.
      for (const playerEntity of world.query().with('player').all()) {
        const velocity = world.getComponent('velocity2d', { from: playerEntity })

        expect(velocity).toBeInstanceOf(PhysicsComponents.Velocity2d)

        velocity.velocity = new Vector2D(1, 0)
      }

      PlayerSystems.processInputs(world, {
        currentTime: 50,
        worldLimits: new Vector2D(Infinity, Infinity)
      })

      // Check that the positions of the players are what we expect.
      for (const playerEntity of world.query().with('player').all()) {
        const transform = world.getComponent('transform2d', { from: playerEntity })

        expect(transform.position.x).toBe(50)
        expect(transform.position.y).toBe(0)
      }
    })

    it('should reject inputs with invalid sequence numbers', () => {
      const world = setUpForInput()
      const player = TEST_PLAYERS[0]

      PlayerSystems.addPlayerTo(world, {
        ...player,
        id: 1
      })

      expect(world.numEntities).toBe(1)

      const playerEntity = world.query().with('player').find(e => {
        return world.getComponent('player', { from: e }).id === 1
      }).one()

      // Add the invalid input.
      const info = world.getComponent('player', {
        from: playerEntity
      })

      info.inputQueue.push({
        inputNum: -1,
        timestamp: 100,
        direction: { up: true, down: true, left: true, right: true }
      })

      expect(info.inputQueue).toHaveSize(1)

      PlayerSystems.processInputs(world, {
        currentTime: 100,
        worldLimits: new Vector2D(Infinity, Infinity)
      })

      const transform = world.getComponent('transform2d', { from: playerEntity })
      expect(transform.position.x).toBe(0)
      expect(transform.position.y).toBe(0)
    })

    it('should reject inputs with invalid timestamps', () => {
      const world = setUpForInput()
      const player = TEST_PLAYERS[0]

      PlayerSystems.addPlayerTo(world, {
        ...player,
        id: 1
      })

      expect(world.numEntities).toBe(1)

      const playerEntity = world.query().with('player').find(e => {
        return world.getComponent('player', { from: e }).id === 1
      }).one()

      // Add the invalid input.
      const info = world.getComponent('player', {
        from: playerEntity,
        worldLimits: new Vector2D(Infinity, Infinity)
      })

      info.inputQueue.push({
        inputNum: 1,
        timestamp: -100,
        direction: { up: true, down: true, left: true, right: true }
      })

      expect(info.inputQueue).toHaveSize(1)

      PlayerSystems.processInputs(world, {
        currentTime: 100
      })

      const transform = world.getComponent('transform2d', { from: playerEntity })
      expect(transform.position.x).toBe(0)
      expect(transform.position.y).toBe(0)
    })

    it('should be able to process one input for each player', () => {
      const world = setUpForInput()
      const players = TEST_PLAYERS.slice(2)

      players.forEach((player, i) => PlayerSystems.addPlayerTo(world, {
        ...player,
        id: i
      }))

      expect(world.numEntities).toBe(2)

      // Add inputs to the players.
      for (const playerEntity of world.query().with('player').all()) {
        const info = world.getComponent('player', { from: playerEntity })

        expect(info).toBeInstanceOf(Player)

        info.inputQueue.push({
          inputNum: 1,
          timestamp: 100,
          direction: { down: true, right: true }
        })

        expect(info.inputQueue).toHaveSize(1)
      }

      PlayerSystems.processInputs(world, {
        currentTime: 100,
        worldLimits: new Vector2D(Infinity, Infinity)
      })

      // Check that the positions of the players are what we expect.
      for (const playerEntity of world.query().with('player').all()) {
        const transform = world.getComponent('transform2d', { from: playerEntity })

        expect(transform.position.x).toBe(100)
        expect(transform.position.y).toBe(100)
      }
    })

    it('should be able to process multiple inputs for each player', () => {
      const world = setUpForInput()
      const players = TEST_PLAYERS.slice(2)

      players.forEach((player, i) => PlayerSystems.addPlayerTo(world, {
        ...player,
        id: i
      }))

      expect(world.numEntities).toBe(2)

      // Add inputs to the players.
      for (const playerEntity of world.query().with('player').all()) {
        const info = world.getComponent('player', { from: playerEntity })

        expect(info).toBeInstanceOf(Player)

        info.inputQueue.push({
          inputNum: 1,
          timestamp: 100,
          direction: { down: true, right: true }
        })
        info.inputQueue.push({
          inputNum: 2,
          timestamp: 200,
          direction: { down: false, right: true }
        })
        info.inputQueue.push({
          inputNum: 3,
          timestamp: 250,
          direction: { up: true, right: false }
        })
        info.inputQueue.push({
          inputNum: 4,
          timestamp: 300,
          direction: { up: false }
        })

        expect(info.inputQueue).toHaveSize(4)
      }

      PlayerSystems.processInputs(world, {
        currentTime: 300,
        worldLimits: new Vector2D(Infinity, Infinity)
      })

      // Check that the positions of the players are what we expect.
      for (const playerEntity of world.query().with('player').all()) {
        const transform = world.getComponent('transform2d', { from: playerEntity })

        expect(transform.position.x).toBe(200)
        expect(transform.position.y).toBe(50)
      }
    })
  })
})
