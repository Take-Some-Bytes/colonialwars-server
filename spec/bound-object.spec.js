/* eslint-env jasmine */
/**
 * @fileoverview Specs for the BoundObject class.
 */

const Vector2D = require('../lib/game/physics/vector-2d')
const BoundObject = require('../lib/game/physics/bound-object')

describe('The BoundObject class,', () => {
  const objPosition = new Vector2D(100, 100)
  const bounds = {
    MIN: 0,
    MAX: 200
  }
  let boundObj = null

  it('should construct without error', () => {
    let err = null

    try {
      boundObj = new BoundObject(objPosition, bounds)
    } catch (ex) {
      err = ex
    }

    expect(err).toBe(null)
    expect(boundObj).toBeInstanceOf(BoundObject)
  })

  describe('its .inBounds method,', () => {
    it('should return true if object is in bounds', () => {
      let inBounds = false
      if (boundObj instanceof BoundObject) {
        inBounds = boundObj.inBounds()
      }

      expect(inBounds).toBe(true)
    })

    it('should return false if object is not in bounds', () => {
      let inBounds = false
      if (boundObj instanceof BoundObject) {
        boundObj.position = new Vector2D(300, 300)
        inBounds = boundObj.inBounds()
      }

      expect(inBounds).toBe(false)
    })
  })

  describe('its .boundToBounds method,', () => {
    it('should bound its position if its current position is out of bounds', () => {
      const oldPos = boundObj.position.copy()

      if (boundObj instanceof BoundObject) {
        boundObj.boundToBounds()
      }

      expect(oldPos).not.toEqual(boundObj.position)
    })
    it('should not do anything if its current position is in bounds', () => {
      const oldPos = boundObj.position.copy()

      if (boundObj instanceof BoundObject) {
        boundObj.boundToBounds()
      }

      expect(oldPos).toEqual(boundObj.position)
    })
  })
})
