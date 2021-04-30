/* eslint-env node */
/**
 * @fileoverview Player class to handle player logic.
 */

const debug = require('debug')('colonialwars:player')

const Vector2D = require('./physics/vector-2d')
const BoundEntity = require('./physics/bound-entity')

/**
 * @typedef {Object} PlayerConfig
 * @prop {string} name
 * @prop {string} team
 * @prop {string} socketID
 * @prop {import('debug').Debugger} debug
 * @prop {InstanceType<Vector2D>} position
 * @prop {number} PLAYER_SPEED
 * @prop {import('./physics/bound-entity').Bounds} WORLD_BOUNDS
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
 * Player class.
 * @extends BoundEntity
 */
class Player extends BoundEntity {
  /**
   * Constructor for a Player class.
   * @param {PlayerConfig} config Configurations.
   */
  constructor (config) {
    const {
      name, team, socketID, position,
      PLAYER_SPEED, WORLD_BOUNDS
    } = config
    super(position, WORLD_BOUNDS)

    this.name = name
    this.team = team
    this.socketID = socketID
    this.position = position
    this.speed = PLAYER_SPEED

    this.velocity = Vector2D.zero()

    this.lastUpdateTime = 0
    this.deltaTime = 0

    /**
     * Array of queued inputs for this player.
     * @type {Array<PlayerInput>}
     */
    this.inputQueue = []
    /**
     * Sequence number of the last input processed.
     */
    this.lastProcessedInput = 0
  }

  /**
   * Gets the velocity of this player with the given input.
   * @param {PlayerInput} data The input data.
   * @returns {InstanceType<Vector2D>}
   * @private
   */
  _getVelocity (data) {
    const directionData = data.direction
    const verticalVelocity = Vector2D.zero()
    const horizontalVelocity = Vector2D.zero()

    if (directionData.up) {
      verticalVelocity.add(Vector2D.fromArray([0, -this.speed]))
    } else if (directionData.down) {
      verticalVelocity.add(Vector2D.fromArray([0, this.speed]))
    } else {
      verticalVelocity.zero()
    }

    if (directionData.left) {
      horizontalVelocity.add(Vector2D.fromArray([-this.speed, 0]))
    } else if (directionData.right) {
      horizontalVelocity.add(Vector2D.fromArray([this.speed, 0]))
    } else {
      horizontalVelocity.zero()
    }

    return Vector2D.zero().add(verticalVelocity).add(horizontalVelocity)
  }

  /**
   * Performs a physics update for this Player object. Not to be called
   * by the end user.
   * @param {number} deltaTime The time since the last update.
   * @private
   */
  _update (deltaTime) {
    this.position.add(Vector2D.floorAxes(Vector2D.scale(this.velocity, deltaTime)))
    this.boundToBounds()
  }

  /**
   * Adds an input object to this Player's input queue.
   * @param {PlayerInput} data An object storing the input data.
   */
  addInputToQueue (data) {
    if (
      typeof data.timestamp !== 'number' ||
      isNaN(data.timestamp) || !isFinite(data.timestamp)
    ) {
      // The timestamp is non-existent or invalid.
      // Reject it.
      debug('Received invalid timestamp for input #%d', data.inputNum)
      throw new TypeError('Invalid input timestamp!')
    }

    const directionData = Object.fromEntries(Object.entries(
      data.direction
    ).map(entry => [entry[0], Boolean(entry[1])]))

    this.inputQueue.push({
      timestamp: data.timestamp,
      inputNum: data.inputNum,
      direction: directionData
    })
  }

  /**
   * Processes all the queued inputs.
   */
  processInputs () {
    const inputs = this.inputQueue.splice(0)
    let nextInput = null

    if (inputs.length < 1) {
      // There are no input changes.
      // Continue doing what we did last time.
      const currentTime = Date.now()
      this._update(currentTime - this.lastUpdateTime)
      this.lastUpdateTime = currentTime
      return
    }

    while ((nextInput = inputs.shift())) {
      const input = nextInput

      if (input.inputNum <= this.lastProcessedInput) {
        // Input sequence number is smaller than last processed input,
        // number, so we gotta skip it.
        debug(
          'Received invalid input sequence number! ' +
          'Last received input: #%d, invalid input: #%d',
          this.lastProcessedInput, input.inputNum
        )
        continue
      } else if (input.timestamp < this.lastUpdateTime) {
        // Input happened earlier than the occurance of the last update,
        // which should not happen. SKIP!
        debug(
          'Received invalid input timestamp! ' +
          'Timestamp records an earlier time than last update time.'
        )
        continue
      }

      this.updateOnInput(input)
      const deltaTime = input.timestamp - this.lastUpdateTime
      this.lastUpdateTime = input.timestamp

      this._update(deltaTime)

      // Record the last processed input.
      this.lastProcessedInput = input.inputNum
    }
  }

  /**
   * Updates the state of this player.
   */
  update () {
    this.processInputs()
  }

  /**
   * Updates this Player class on input from the actual player.
   * @param {PlayerInput} input The input object that was received.
   */
  updateOnInput (input) {
    this.velocity = this._getVelocity(input)
  }
}

module.exports = exports = Player
