/* eslint-env node */
/**
 * @fileoverview Utility functions for arrays of all kinds.
 */

const ArrayUtils = {
  /**
   * Remove the specified element from the array.
   *
   * Swaps the removed element with the last element of the array and then deletes
   * the last element. If the removed element *is* the last element, simply deletes
   * that element.
   *
   * The deleted element is returned. If the array is empty, returns null.
   * @param {Array<T>} arr The array to perform the swap-remove on.
   * @param {number} idx The index to swap-remove.
   * @returns {T|null}
   * @template T
   */
  swapRemove: (arr, idx) => {
    if (arr.length === 0) {
      return null
    }

    const last = arr.length - 1
    // The to-be-removed element is the last element.
    // No swapping necessary.
    if (idx === last) {
      return arr.pop()
    }

    // Swap the to-be-removed element and the last element.
    [arr[idx], arr[last]] = [arr[last], arr[idx]]
    // Remove the last element.
    return arr.pop()
  }
}

const Uint32ArrUtils = {
  MAX_UINT32: 4294967295,
  /**
   * Creates an Uint32Array with the specified length, filled with ``MAX_UINT32``
   * @param {number} length The capacity of the array.
   * @returns {Uint32Array}
   */
  withLength: length => Uint32Array.from(
    { length }, () => Uint32ArrUtils.MAX_UINT32
  ),
  /**
   * "Resizes" an Uint32Array.
   *
   * Returns a new Uint32Array that contains the elements of the original Uint32Array
   * but having the specified new size.
   * @param {Uint32Array} original The original Uin32Array.
   * @param {number} newSize The *total* size of the new Uint32Array.
   * @returns {Uint32Array}
   */
  resize: (original, newSize) => {
    return Uint32Array.from({ length: newSize }, (_, i) => {
      if (i < original.length) {
        return original[i]
      }

      return Uint32ArrUtils.MAX_UINT32
    })
  }
}

module.exports = {
  ArrayUtils,
  Uint32ArrUtils
}
