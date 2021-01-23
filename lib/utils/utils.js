/* eslint-env node */
/**
 * @fileoverview Utility functions. There's no reason to wrap this
 * in a class... Right? I believe so.
 */

const NO_FREEZE = Symbol('NO_FREEZE')

/**
 * Deep-freezes an object.
 * @param {Object} object The object to deep freeze.
 * @returns {Object}
 */
function deepFreeze (object) {
  // Retrieve the property names defined on object.
  const propNames = Object.getOwnPropertyNames(object)
  // Check for a special "NO_FREEZE" symbol.
  if (object[NO_FREEZE] === true) {
    return
  }
  // Freeze properties before freezing self.
  for (const name of propNames) {
    const value = object[name]
    if (value && typeof value === 'object') {
      // Check for a special "NO_FREEZE" symbol.
      if (value[NO_FREEZE] === true) {
        continue
      }
      deepFreeze(value)
    }
  }
  return Object.freeze(object)
}

/**
 * Test if a string is lowercase or not.
 * @param {string} str The string to test.
 * @returns {boolean}
 */
function isLowerCase (str) {
  return str === str.toLowerCase() && str !== str.toUpperCase()
}

/**
 * Filters an environment variable object. Most notably, removes all lowercase
 * environment variables.
 * @param {Object<string, string>} env The environment variable object to filter.
 * @returns {Object<string, string>}
 */
function filterEnv (env) {
  // Copy the env object.
  const _env = Object.assign({}, env)
  Object.keys(_env).forEach(key => {
    if (isLowerCase(key)) {
      delete _env[key]
    }
  })

  return _env
}

module.exports = exports = {
  // Symbols:
  NO_FREEZE,
  // Functions:
  deepFreeze,
  isLowerCase,
  filterEnv
}
