/* eslint-env node */
/**
 * @fileoverview Player class to handle player logic.
 */

const Vector2D = require('./physics/vector-2d')
const BoundObject = require('./physics/bound-object')

/**
 * @typedef {Object} PlayerConfig
 * @prop {number} PLAYER_SPEED
 * @prop {import('./physics/bound-object').Bounds} WORLD_BOUNDS
 *
 * @typedef {Object} InputData
 * @prop {Object} direction
 * @prop {boolean} direction.up
 * @prop {boolean} direction.down
 * @prop {boolean} direction.right
 * @prop {boolean} direction.left
 */

/**
 * Player class.
 */
class Player extends BoundObject {
  /**
   * Constructor for a Player class.
   * @param {string} name The name of the player.
   * @param {string} team The team of the player.
   * @param {string} socketID The Socket ID associated with this player.
   * @param {InstanceType<Vector2D>} position The starting position of the player.
   * @param {PlayerConfig} config Configurations.
   */
  constructor (name, team, socketID, position, config) {
    const { PLAYER_SPEED, WORLD_BOUNDS } = config
    super(position, WORLD_BOUNDS)

    this.name = name
    this.team = team
    this.socketID = socketID
    this.position = position
    this.speed = PLAYER_SPEED

    this.velocity = Vector2D.zero()

    this.lastUpdateTime = 0
    this.deltaTime = 0
  }

  /**
   * Performs an update for this Player class.
   * @param {number} lastUpdateTime The last time an update occured.
   * @param {number} deltaTime The difference between the current time and the last
   * time an update occured.
   */
  update (lastUpdateTime, deltaTime) {
    this.lastUpdateTime = lastUpdateTime
    this.position.add(Vector2D.scale(this.velocity, deltaTime))
    this.boundToBounds()
  }

  /**
   * Updates this Player class on input from the actual player.
   * @param {InputData} input The input object that was received.
   */
  updateOnInput (input) {
    const direction = input.direction
    if (direction.up) {
      this.velocity = new Vector2D(0, -this.speed)
    } else if (direction.down) {
      this.velocity = new Vector2D(0, this.speed)
    } else if (direction.right) {
      this.velocity = new Vector2D(this.speed, 0)
    } else if (direction.left) {
      this.velocity = new Vector2D(-this.speed, 0)
    } else if (!(direction.left || direction.down || direction.right || direction.down)) {
      this.velocity = Vector2D.zero()
    }
  }
}

module.exports = exports = Player
