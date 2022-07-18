/* eslint-env node */
/**
 * @fileoverview TimedStore class to store values for only the specified amount
 * of time. Useful for session stores and such.
 */

/**
 * @typedef {import('timers')} DUMMY
 */

/**
 * @typedef {Object} TimedStoreOptions
 * @prop {number} maxAge The max age for items in the TimedStore.
 * @prop {number} maxItems
 * The maximum amount of items that could be stored in this TimedStore.
 * @prop {boolean} strict If true, an item's expiry time could not be reset.
 */

/**
 * DOING: Removing LRU cache from TimedStore.
 */

/**
 * TimedStore class.
 */
export default class TimedStore {
  /**
   * Constructor for a TimedStore class, which stores items for only the
   * specified amount of time.
   * @param {TimedStoreOptions} opts Options.
   */
  constructor (opts) {
    const {
      maxAge, maxItems, strict
    } = opts

    /** @type {Map<string, string>} */
    this._cache = new Map()
    /** @type {Map<string, NodeJS.Timeout>} */
    this._timers = new Map()

    this.strict = strict
    this.maxAge = maxAge
    this.maxItems = maxItems
  }

  /**
   * Sets a timeout for the specified item.
   * @param {string} key The key of the item.
   * @private
   */
  _setItemTimeout (key) {
    const timeout = setTimeout(() => this.del(key), this.maxAge).unref()

    if (this._timers.has(key)) {
      clearTimeout(this._timers.get(key))
    }
    this._timers.set(key, timeout)
  }

  /**
   * Gets the specified key.
   * @param {string} key The key of the item to get.
   * @returns {string}
   */
  get (key) {
    if (this.strict) {
      // No max-age reset for you.
      return this._cache.get(key)
    }

    // Reset max-age timeout.
    this._setItemTimeout(key)

    return this._cache.get(key)
  }

  /**
   * Sets a key's value.
   * @param {string} key The key to set.
   * @param {string} val The value to set the key to.
   * @returns {boolean}
   */
  set (key, val) {
    this._setItemTimeout(key)
    return this._cache.set(key, val)
  }

  /**
   * Checks if a key exists in this cache.
   * @param {string} key The key to check
   * @returns {boolean}
   */
  has (key) {
    return this._cache.has(key)
  }

  /**
   * Deletes the specified item from this TimedStore.
   * @param {string} key The key to delete.
   */
  del (key) {
    if (this._timers.has(key)) {
      clearTimeout(this._timers.get(key))
    }
    this._timers.delete(key)
    return this._cache.delete(key)
  }
}
