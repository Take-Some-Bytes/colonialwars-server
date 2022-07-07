/* eslint-env jasmine */
/**
 * @fileoverview Specs for a sparse set.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const SparseSet = require('../../lib/ecs/sparse-set')

describe('The SparseSet class', () => {
  it('should be able to construct with the specified capacity', () => {
    const set = new SparseSet(4)

    expect(set.length).toBe(0)
    expect(set.capacity).toBe(4)
  })

  describe('when inserting values', () => {
    it('should be able to insert values', () => {
      const set = new SparseSet(4)

      set.insert(2, 10)

      expect(set.length).toBe(1)
      expect(set.capacity).toBe(4)

      set.insert(3, 10)

      expect(set.length).toBe(2)
      expect(set.capacity).toBe(4)
    })

    it('should be override entries with same keys', () => {
      const set = new SparseSet(4)

      set.insert(2, 10)

      expect(set.length).toBe(1)
      expect(set.capacity).toBe(4)

      set.insert(2, NaN)

      expect(set.length).toBe(1)
      expect(set.capacity).toBe(4)
    })

    it('should require numeric keys', () => {
      const set = new SparseSet(4)

      expect(() => set.insert('not a number', 0)).toThrowError(TypeError)
      expect(() => set.insert(1, 0)).not.toThrowError(TypeError)
    })

    it('should be able to insert more than its capacity', () => {
      const set = new SparseSet(1)

      set.insert(0, 1409)

      expect(set.length).toBe(1)
      expect(set.capacity).toBe(1)

      set.insert(2, 40)
      set.insert(3, NaN)
      set.insert(8, 881)

      expect(set.length).toBe(4)
      expect(set.capacity).toBeGreaterThanOrEqual(5)
    })
  })

  it('should be able to delete stored values', () => {
    const set = new SparseSet(4)

    set.insert(2, 10)
    set.insert(1, 4012)

    expect(set.length).toBe(2)
    expect(set.capacity).toBe(4)

    set.delete(2)

    expect(set.length).toBe(1)
    expect(set.capacity).toBe(4)
  })

  it('should be able to test if values exist', () => {
    const set = new SparseSet(4)

    expect(set.has(3)).toBeFalse()
    expect(set.length).toBe(0)
    expect(set.capacity).toBe(4)

    set.insert(3, 581902)

    expect(set.has(3)).toBeTrue()
    expect(set.length).toBe(1)
    expect(set.capacity).toBe(4)

    set.delete(3)

    expect(set.has(3)).toBeFalse()
    expect(set.length).toBe(0)
    expect(set.capacity).toBe(4)
  })

  it('should be able to clear stored values', () => {
    const set = new SparseSet(100)

    for (let i = 0; i < 100; i++) {
      set.insert(i, `${i}-item`)
    }

    expect(set.length).toBe(100)

    set.clear()

    expect(set.length).toBe(0)
    expect(set.capacity).toBe(100)
  })

  it('should be able to access stored values', () => {
    const set = new SparseSet(4)

    set.insert(2, 10)

    expect(set.get(2)).toBe(10)
    expect(set.length).toBe(1)
    expect(set.capacity).toBe(4)

    set.clear()

    expect(set.get(2)).toBeFalsy()
    expect(set.length).toBe(0)
    expect(set.capacity).toBe(4)
  })

  describe('when iterating', () => {
    it('should be able to iterate over keys', () => {
      const set = new SparseSet(16)

      for (let i = 0; i < 16; i++) {
        set.insert(i, `${i}-item`)
      }

      expect(set.length).toBe(16)
      expect(set.capacity).toBe(16)

      let idx = 0
      for (const key of set.keys()) {
        expect(key).toBe(idx)

        idx++
      }
    })

    it('should be able to iterate over values', () => {
      const set = new SparseSet(16)

      for (let i = 0; i < 16; i++) {
        set.insert(i, `${i}-item`)
      }

      expect(set.length).toBe(16)
      expect(set.capacity).toBe(16)

      let idx = 0
      for (const val of set.values()) {
        expect(val).toBe(`${idx}-item`)

        idx++
      }
    })

    it('should be able to iterate over entries', () => {
      const set = new SparseSet(16)

      for (let i = 0; i < 16; i++) {
        set.insert(i, `${i}-item`)
      }

      expect(set.length).toBe(16)
      expect(set.capacity).toBe(16)

      let idx = 0
      for (const [key, val] of set.entries()) {
        expect(key).toBe(idx)
        expect(val).toBe(`${idx}-item`)

        idx++
      }
    })
  })
})
