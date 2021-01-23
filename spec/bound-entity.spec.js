/* eslint-env jasmine */
/**
 * @fileoverview Specs for the BoundEntity class.
 */

const Vector2D = require('../lib/game/physics/vector-2d')
const BoundEntity = require('../lib/game/physics/bound-entity')

describe('The BoundEntity class,', () => {
  const objPosition = new Vector2D(100, 100)
  const bounds = {
    MIN: 0,
    MAX: 200
  }
  let boundObj = null

  it('should construct without error', () => {
    let err = null

    try {
      boundObj = new BoundEntity(objPosition, bounds)
    } catch (ex) {
      err = ex
    }

    expect(err).toBe(null)
    expect(boundObj).toBeInstanceOf(BoundEntity)
  })

  describe('its .inBounds method,', () => {
    it('should return true if object is in bounds', () => {
      let inBounds = false
      if (boundObj instanceof BoundEntity) {
        inBounds = boundObj.inBounds()
      }

      expect(inBounds).toBe(true)
    })

    it('should return false if object is not in bounds', () => {
      let inBounds = false
      if (boundObj instanceof BoundEntity) {
        boundObj.position = new Vector2D(300, 300)
        inBounds = boundObj.inBounds()
      }

      expect(inBounds).toBe(false)
    })
  })

  describe('its .boundToBounds method,', () => {
    it('should bound its position if its current position is out of bounds', () => {
      const oldPos = boundObj.position.copy()

      if (boundObj instanceof BoundEntity) {
        boundObj.boundToBounds()
      }

      expect(oldPos).not.toEqual(boundObj.position)
    })
    it('should not do anything if its current position is in bounds', () => {
      const oldPos = boundObj.position.copy()

      if (boundObj instanceof BoundEntity) {
        boundObj.boundToBounds()
      }

      expect(oldPos).toEqual(boundObj.position)
    })
  })
})
