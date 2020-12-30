/**
 * @fileoverview Mock ServerUtils class.
 */

/**
 * Dumps sent error stats in this class.
 */
class MockServerUtils {
  constructor () {
    this.numErrorsSent = 0
    this.errors = {}
  }

  /**
   * "Sends" an error.
   * @param {Object} opts The options.
   * @returns {import('express').Handler}
   */
  sendError (opts) {
    return (req, res) => {
      this.numErrorsSent++
      this.errors[`Error-${this.numErrorsSent}`] = {
        error: opts,
        handlerInfo: {
          req, res
        }
      }
    }
  }
}

module.exports = exports = MockServerUtils
