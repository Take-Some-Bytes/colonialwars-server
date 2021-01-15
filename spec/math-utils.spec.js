/* eslint-env jasmine */
/**
 * @fileoverview Specs for utility functions that mess with math.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const mathUtils = require('../lib/utils/math-utils')

describe('The Colonial Wars math utilities object,', () => {
  it('should have four properties', () => {
    expect(Object.keys(mathUtils).length).toBe(4)
  })

  it('should have four functions', () => {
    const numVals = Object.values(mathUtils)
    let numFuncs = 0

    numVals.forEach(val => {
      switch (typeof val) {
        case 'function':
          numFuncs++
          break
      }
    })

    expect(numFuncs).toBe(4)
  })

  it('should be able to detect whether a value is in the specified bounds', () => {
    const bounds = { MIN: 0, MAX: 200 }
    const values = [200, 300, -100, 100, 0]
    const results = []

    values.forEach(val => {
      results.push(mathUtils.inBound(val, bounds.MIN, bounds.MAX))
    })

    expect(results.length).toBe(5)
    expect(results[0]).toBe(true)
    expect(results[1]).toBe(false)
    expect(results[2]).toBe(false)
    expect(results[3]).toBe(true)
    expect(results[4]).toBe(true)
  })

  it('should be able to bound values to the specified bounds', () => {
    const bounds = { MIN: 0, MAX: 200 }
    const values = [200, 300, -100, 100, 0, 3]
    const results = []

    values.forEach(val => {
      results.push(mathUtils.bound(val, bounds.MIN, bounds.MAX))
    })

    expect(results.length).toBe(6)
    expect(results[0]).toBe(200)
    expect(results[1]).toBe(200)
    expect(results[2]).toBe(0)
    expect(results[3]).toBe(100)
    expect(results[4]).toBe(0)
    expect(results[5]).toBe(3)
  })

  it('should be able to convert degrees to radians', () => {
    const angles = [180, 90, 45, 30]
    const results = []

    angles.forEach(angle => {
      results.push(mathUtils.degToRad(angle))
    })

    expect(results.length).toBe(4)
    expect(results[0]).toBeCloseTo(3.14159)
    expect(results[1]).toBeCloseTo(1.5708)
    expect(results[2]).toBeCloseTo(0.785398)
    expect(results[3]).toBeCloseTo(0.523599)
  })

  it('should be able to convert radians to degrees', () => {
    const angles = [3.14159, 1.5708, 0.785398, 0.523599]
    const results = []

    angles.forEach(angle => {
      results.push(mathUtils.radToDeg(angle))
    })

    expect(results.length).toBe(4)
    // We'll have to round the results--radians don't convert perfectly to whole numbers.
    expect(Math.round(results[0])).toBe(180)
    expect(Math.round(results[1])).toBe(90)
    expect(Math.round(results[2])).toBe(45)
    expect(Math.round(results[3])).toBe(30)
  })
})
