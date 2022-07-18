/* eslint-env jasmine */
/**
 * @fileoverview Specs for the Vector2D class, which represents a 2D point
 * in 2D space.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const Vector2D = require('../../lib/game/physics/vector2d')

describe('The Vector2D class,', () => {
  it('should be able to floor fractional axes', () => {
    const vector = new Vector2D(3.12, 5.13)
    const floored = Vector2D.floorAxes(vector)

    expect(floored).toEqual(new Vector2D(3, 5))
  })
  it('should be able to copy itself', () => {
    const vector = new Vector2D(40, 102)
    const other = vector.copy()

    expect(vector).toEqual(other)
    expect(vector).not.toBe(other)
  })
  it('should be able to reset both its axes', () => {
    const vector = new Vector2D(50, 100)

    expect(vector.x).toEqual(50)
    expect(vector.y).toEqual(100)

    vector.zero()

    expect(vector.x).toEqual(0)
    expect(vector.y).toEqual(0)
  })
  it('should be able to bind itself to the specified bounds', () => {
    const vector = new Vector2D(40, 102)
    const bounds = new Vector2D(40, 40)

    vector.boundTo(bounds)

    expect(vector).toEqual(bounds)
  })

  describe('when performing vector arithmetic,', () => {
    it('should be able to scale a Vector2D by a constant scalar', () => {
      const vector = new Vector2D(2, 3)
      const scaled = Vector2D.scale(vector, 4)

      expect(scaled).toEqual(new Vector2D(8, 12))
    })
    it('should be able to add another Vector2D', () => {
      const vector = new Vector2D(40, 10)
      const other = new Vector2D(50, 100)
      const result = vector.add(other)

      expect(result).toBe(vector)
      expect(result).toEqual(vector)
      expect(result).toEqual(new Vector2D(90, 110))
      expect(other).toEqual(new Vector2D(50, 100))
    })
  })

  describe('when constructing,', () => {
    it('should return a Vector2D of zeroes if now arguments are provided', () => {
      const vector = new Vector2D()

      expect(vector.x).toEqual(0)
      expect(vector.y).toEqual(0)
    })
    it('should return a Vector2D with the specified coordinates', () => {
      const vector = new Vector2D(300, 184)

      expect(vector.x).toEqual(300)
      expect(vector.y).toEqual(184)
    })
    it('should be able to explicity return a Vector2D of zeroes', () => {
      const vector = Vector2D.zero()

      expect(vector.x).toEqual(0)
      expect(vector.y).toEqual(0)
    })
  })

  describe('when converting,', () => {
    it('should be able to convert an array into a Vector2D', () => {
      const arr = [100, 300]
      const vector = Vector2D.fromArray(arr)

      expect(vector).toBeInstanceOf(Vector2D)
      expect(vector).toEqual(new Vector2D(100, 300))
    })
    it('should be able to convert an object into a Vector2D', () => {
      const obj = { x: 502, y: 481 }
      const vector = Vector2D.fromObject(obj)

      expect(vector).toBeInstanceOf(Vector2D)
      expect(vector).toEqual(new Vector2D(502, 481))
    })
    it('should be able to convert polar coordinates into a Vector2D', () => {
      const polar = {
        radius: 10,
        theta: 90
      }
      const vector = Vector2D.fromPolar(polar.radius, polar.theta)

      expect(vector).toBeInstanceOf(Vector2D)
      expect(vector).toEqual(new Vector2D(
        polar.radius * Math.cos(polar.theta),
        polar.radius * Math.sin(polar.theta)
      ))
    })
  })
})
