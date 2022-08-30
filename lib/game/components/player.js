/* eslint-env node */
/**
 * @fileoverview Player component.
 */

/**
 * @typedef {Object} PlayerOpts
 * @prop {string} id
 * @prop {string} name
 * @prop {string} team
 *
 * @typedef {Object} PlayerInput
 * @prop {number} inputNum
 * @prop {number} timestamp
 * @prop {Object} direction
 * @prop {boolean} direction.up
 * @prop {boolean} direction.down
 * @prop {boolean} direction.right
 * @prop {boolean} direction.left
 */

/**
 * The Player component contains all the data a player entity needs to function.
 */
export default class Player {
  /**
   * Gets the serializable properties of this component.
   * @returns {Array<string>}
   */
  static get properties () {
    return ['name', 'team', 'lastProcessedInput']
  }

  /**
   * Create a new Player component.
   *
   * The Player component stores the ID, name, and team of a player, and it also
   * provides an input queue, the last processed input, and the last update time.
   * @param {PlayerOpts} opts Required options.
   */
  constructor (opts) {
    this.id = opts.id
    this.name = opts.name
    this.team = opts.team

    /**
     * @type {Array<PlayerInput>}
     */
    this.inputQueue = []
    this.lastProcessedInput = 0
    this.lastUpdateTime = 0
  }
}
