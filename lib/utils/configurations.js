/* eslint-env node */
/**
 * @fileoverview Configurations class to read application configurations.
 */

const fs = require('fs').promises
const utils = require('./utils')

/**
 * Configurations class for safe accessing of configurations.
 */
class Configurations {
  /**
   * Constructor for a Configurations class. You may only set configurations
   * one time. After the first time, it is read-only.
   * @param {Object<string, any>} config The configurations that was received
   * from user input.
   */
  constructor (config) {
    this.config = config
    this._deepFreeze()
  }

  /**
   * Gets the property specified. Returns `null` if
   * property does not exist.
   * @param  {...string} propNames Property names.
   * @returns {any}
   */
  get (...propNames) {
    let val = null
    for (const prop of propNames) {
      // Get the next value.
      val = typeof val === 'object' && val !== null
        ? val[prop]
        : this.config[prop]

      // If val is undefined, return null. Why null?
      // So that we know "nothing" has been returned intentionally.
      if (val === undefined) {
        return (val = null)
      }
    }
    return val
  }

  /**
   * Deep freezes configurations object.
   * @private
   */
  _deepFreeze () {
    if (Object.isFrozen(this.config)) { return }
    utils.deepFreeze(this.config)
  }

  /**
   * Reads a JSON configuration from the specified path.
   * @param {string} path The path of the configurations.
   * @param {Object} [fallbacks] Fallbacks if the config file could not be read.
   * @returns {Promise<Configurations>}
   */
  static async readFrom (path, fallbacks) {
    let contents = null
    try {
      contents = await fs.readFile(path)
    } catch (err) {
      // Only throw the error if no fallbacks were specified.
      if (fallbacks) {
        contents = JSON.stringify(fallbacks)
      } else {
        throw new Error(
          'Error occured while reading configurations!' +
          `Error: ${err.stack}`
        )
      }
    }
    const parsedContents = JSON.parse(contents.toString('utf-8'))
    return new Configurations(parsedContents)
  }

  /**
   * Creates a Configurations object from an array of objects.
   * @param  {...Object<string, any>} objs The objects to create the Configurations object from.
   * @returns {Configurations}
   */
  static from (...objs) {
    const confObj = objs.reduce((prevObj, currentObj) => {
      return Object.assign(prevObj, currentObj)
    }, {})
    return new Configurations(confObj)
  }
}

module.exports = exports = Configurations
