/* eslint-env jasmine */
/**
 * @fileoverview Specs for array utilities.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

import { Uint32ArrUtils, ArrayUtils } from '../../lib/utils/array-utils.js'

describe('The ArrayUtils object,', () => {
  describe('when swap-removing elements,', () => {
    it('should be able to remove elements', () => {
      const arr = [10, 3289, 1442, 11]

      expect(arr).toHaveSize(4)
      expect(arr).toContain(3289)

      const ret = ArrayUtils.swapRemove(arr, 1)

      expect(ret).toBe(3289)
      expect(arr).toHaveSize(3)
      expect(arr).not.toContain(3289)
    })

    it('should change the order of elements if the removed element is not the last', () => {
      const arr = [10, 3289, 1442, 11]

      expect(arr).toHaveSize(4)
      expect(arr).toContain(3289)
      expect(arr[1]).toBe(3289)

      ArrayUtils.swapRemove(arr, 1)

      expect(arr).toHaveSize(3)
      expect(arr).not.toContain(3289)
      expect(arr[1]).not.toBe(3289)
      expect(arr[1]).toBe(11)
    })

    it('should not change the order of elements if the removed element is the last', () => {
      const arr = [10, 3289, 1442, 11]

      expect(arr).toHaveSize(4)
      expect(arr).toContain(11)
      expect(arr[2]).toBe(1442)

      ArrayUtils.swapRemove(arr, 3)

      expect(arr).toHaveSize(3)
      expect(arr).not.toContain(11)
      expect(arr[2]).toBe(1442)
    })
  })
})

describe('The Uint32ArrUtils object,', () => {
  const max = 2 ** 32 - 1

  it('should contain the maximum of a uint32', () => {
    expect(Uint32ArrUtils.MAX_UINT32).toBe(max)
  })

  it('should be able to create Uint32Arrays of the specified length', () => {
    const arr = Uint32ArrUtils.withLength(8)

    expect(arr).toHaveSize(8)
    expect(arr).toEqual(new Uint32Array([
      max, max, max, max, max, max, max, max
    ]))
  })

  it('should be able to "resize" Uint32Arrays', () => {
    // In other words it should be able to create a larger Uint32Array and
    // insert elements of a shorter Uint32Array at the start.
    const arr = new Uint32Array([10, 40, 18, 20])

    expect(arr).toHaveSize(4)

    const resized = Uint32ArrUtils.resize(arr, 8)

    expect(resized).toHaveSize(8)
    expect(resized[0]).toBe(arr[0])
    expect(resized[1]).toBe(arr[1])
    expect(resized[2]).toBe(arr[2])
    expect(resized[3]).toBe(arr[3])
    expect(resized.slice(0, 4)).toEqual(arr)
    expect(resized.slice(4)).toEqual(new Uint32Array([
      max, max, max, max
    ]))
  })
})
