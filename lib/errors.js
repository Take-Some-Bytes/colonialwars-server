/* eslint-env node */
/**
 * @fileoverview File to store custom errors.
 */

/**
 * CorsError class.
 */
export class CorsError extends Error {
  /**
   * Constructor for a CorsError class.
   * @param {string} msg The error message.
   */
  constructor (msg) {
    super(msg)

    this.code = 'ECORS'
  }
}
