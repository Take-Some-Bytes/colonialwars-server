/* eslint-env node */
/**
 * @fileoverview TimedStore class to store values for only the specified amount
 * of time. Useful for session stores and such. Internally uses node-lru-cache.
 */

/**
 * @typedef {import('zlib')} DUMMY
 */

const LRU = require('lru-cache')

/**
 * @typedef {Object} TimedStoreOptions
 * @prop {number} maxAge The max age for items in the TimedStore.
 * @prop {number} maxItems
 * The maximum amount of items that could be stored in this TimedStore.
 * @prop {number} pruneInterval The interval to wait before pruning the LRU cache.
 * @prop {boolean} strict If true, an item's expiry time could not be reset.
 */

/**
 * TimedStore class.
 */
class TimedStore {
  /**
   * Constructor for a TimedStore class, which stores items for only the
   * specified amount of time.
   * @param {TimedStoreOptions} opts Options.
   */
  constructor (opts) {
    const {
      maxAge, maxItems, pruneInterval, strict
    } = opts

    /**
     * @type {LRU<string, string>}
     * @private
     */
    this._cache = new LRU({
      max: maxItems,
      maxAge: maxAge,
      updateAgeOnGet: !strict
    })
    /**
     * @private
     * @type {NodeJS.Timeout}
     */
    this._pruneInterval = null

    this.startPruneInterval(pruneInterval)
  }

  /**
   * Starts the pruning interval.
   * @param {number} pruneInterval The interval at which to prune items
   * from the LRU cache.
   */
  startPruneInterval (pruneInterval) {
    this._pruneInterval = setInterval(() => {
      this._cache.prune()
    }, pruneInterval)

    // Unref the prune interval so it won't hang the Node.JS process
    // when we try to shut down.
    this._pruneInterval.unref()
  }

  /**
   * Stops the pruning interval.
   */
  stopPruneInterval () {
    clearInterval(this._pruneInterval)
    this._pruneInterval = null
  }

  /**
   * Gets the specified key.
   * @param {string} key The key of the item to get.
   * @returns {string}
   */
  get (key) {
    return this._cache.get(key)
  }

  /**
   * Sets a key's value.
   * @param {string} key The key to set.
   * @param {string} val The value to set the key to.
   * @returns {boolean}
   */
  set (key, val) {
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
    return this._cache.del(key)
  }
}

module.exports = exports = TimedStore
// module.exports = TimedStore
