/* eslint-env node */
/**
 * @fileoverview Implementation of a sparse set.
 */

const { ArrayUtils, Uint32ArrUtils } = require('../utils/array-utils')

const SPARSE_GROW_MULTIPLIER = 2

/**
 * Implementation of a sparse set.
 *
 * A sparse set guarantees fast iteration of values inserted with non-consecutive
 * indices, and reasonably fast access of stored values.
 * @template V
 */
class SparseSet {
  /**
   * Creates a sparse set with the specified initial capacity.
   *
   * A sparse set guarantees fast iteration of values inserted with non-consecutive
   * indices, and reasonably fast access of stored values.
   * @param {number} [capacity=0] The initial capacity of the sparse set.
   */
  constructor (capacity = 0) {
    /**
     * @type {Array<{ key: number, value: V }>}
     * @private
     */
    this._packed = []
    /**
     * @type {Uint32Array}
     * @private
     */
    this._sparse = Uint32ArrUtils.withLength(capacity)
  }

  /**
   * Gets the total number of elements in this sparse set.
   * @returns {number}
   */
  get length () {
    return this._packed.length
  }

  /**
   * Gets the total number of keys this sparse set can store without
   * expanding its "sparse" array.
   * @returns {number}
   */
  get capacity () {
    return this._sparse.length
  }

  /**
   * Get the position of a value that has the specified key or null.
   * @param {number} key The key to find.
   * @returns {number|null}
   * @private
   */
  _packedIdx (key) {
    if (key >= this.capacity) {
      return null
    }

    const maybeIdx = this._sparse[key]
    if (maybeIdx >= this.length) {
      return null
    }

    const val = this._packed[maybeIdx]
    if (val.key !== key) {
      return null
    }

    return maybeIdx
  }

  /**
   * Tests if the key/index exists in this sparse set.
   * @param {number} key The key/index to test.
   * @returns {boolean}
   */
  has (key) {
    return this._packedIdx(key) !== null
  }

  /**
   * Gets the value at the specified key/index, or null if it doesn't exist.
   * @param {number} key The key/index of the item.
   * @returns {V|null}
   */
  get (key) {
    const maybeIdx = this._packedIdx(key)
    if (maybeIdx === null) {
      return null
    }

    return this._packed[maybeIdx].value
  }

  /**
   * Inserts a value with the specified key/index.
   * @param {number} key The key/index to insert at.
   * @param {V} value The value to insert.
   */
  insert (key, value) {
    if (typeof key !== 'number' || isNaN(key)) {
      throw new TypeError('Expected numeric key!')
    }
    if (key >= Uint32ArrUtils.MAX_UINT32) {
      throw new RangeError('Key out of range!')
    }

    if (key >= this.capacity) {
      // To prevent infinite looping.
      if (this._sparse.length === 0) {
        this._sparse = Uint32ArrUtils.resize(
          this._sparse, 2
        )
      }

      while (key >= this.capacity) {
        this._sparse = Uint32ArrUtils.resize(
          this._sparse, this._sparse.length * SPARSE_GROW_MULTIPLIER
        )
      }
    }

    const maybeIdx = this._packedIdx(key)
    if (maybeIdx !== null) {
      this._packed[maybeIdx].value = value
    } else {
      this._sparse[key] = this._packed.length
      this._packed.push({ key, value })
    }
  }

  /**
   * Deletes the value with the specified key/index.
   *
   * Returns the value if deleted successfully, null otherwise.
   * @param {number} key The key/index to delete.
   * @returns {V|null}
   */
  delete (key) {
    const packedIdx = this._packedIdx(key)
    if (packedIdx === null) {
      return null
    }

    const removed = ArrayUtils.swapRemove(this._packed, packedIdx).value

    // If packedIdx === this.length, that means it was the last element
    // and we don't need to update any indices. Otherwise, we do :(
    if (packedIdx !== this.length) {
      const swapped = this._packed[packedIdx]
      this._sparse[swapped.key] = packedIdx
    }

    return removed
  }

  /**
   * Clears this sparse set.
   */
  clear () {
    this._packed.splice(0)
  }

  /**
   * Gets an iterator that iterates over all the keys, in no particular order.
   * @returns {Generator<number, void, void>}
   */
  * keys () {
    for (const entry of this._packed) {
      yield entry.key
    }
  }

  /**
   * Gets an iterator that iterates over all the values, in no particular order.
   * @returns {Generator<V, void, void>}
   */
  * values () {
    for (const entry of this._packed) {
      yield entry.value
    }
  }

  /**
   * Gets an iterator that iterates over all the entries, in no particular order.
   * @returns {Generator<[number, V], void, void>}
   */
  * entries () {
    for (const entry of this._packed) {
      yield [entry.key, entry.value]
    }
  }
}

module.exports = SparseSet
