/* eslint-env jasmine */
/**
 * @fileoverview Specs for the GameLoader class.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const path = require('path')

const GameLoader = require('../../lib/game/gameloader')
const TeamGame = require('../../lib/game/game-modes/team-game')

const MockLoggers = require('../mocks/internal/mock-loggers')

describe('The static GameLoader.DEFAULT_MAX_CONF_SIZE property,', () => {
  it('should be equal to 1MB (1024 * 1024 * 1024)', () => {
    expect(GameLoader.DEFAULT_MAX_CONF_SIZE).toBe(1024 * 1024 * 1024)
    expect(GameLoader.DEFAULT_MAX_CONF_SIZE).toBe(1073741824)
  })
})

describe('The GameLoader class,', () => {
  let gameLoader = null

  it('should construct without error', () => {
    let err = null

    try {
      gameLoader = new GameLoader({
        baseDir: path.join(__dirname, '../mocks/external/mock-game-confs'),
        gameConstants: {
          playerStats: {
            PLAYER_SPEED: 0.4
          },
          communications: {
            CONN_UPDATE: 'mock-game-update',
            CONN_REMOVE_PLAYER: 'mock-game-remove-player'
          }
        },
        loggers: new MockLoggers()
      })
    } catch (ex) {
      err = ex
    }

    expect(err).toBe(null)
    expect(gameLoader).toBeInstanceOf(GameLoader)
  })

  describe('the .loadConfigFile() method,', () => {
    it('should throw an error if config file does not exist', async () => {
      let config = null
      let err = null

      try {
        if (gameLoader instanceof GameLoader) {
          config = await gameLoader.loadConfigFile('i-dont-exist.json')
        }
      } catch (ex) {
        err = ex
      }

      expect(config).toBe(null)
      expect(err.code).toBe('ENOENT')
    })
    it('should throw an error if config file does not include a `configType` field, or if the `configType` field is not `game-config`', async () => {
      let config = null
      let err = null

      try {
        if (gameLoader instanceof GameLoader) {
          config = await gameLoader.loadConfigFile('invalid-config.json')
        }
      } catch (ex) {
        err = ex
      }

      expect(config).toBe(null)
      expect(err).toBeInstanceOf(TypeError)
      expect(err.message).toBe('Invalid configuration file!')
    })
    it('should not throw an error if config file is valid', async () => {
      let config = null
      let err = null

      try {
        if (gameLoader instanceof GameLoader) {
          config = await gameLoader.loadConfigFile('valid-config.json')
        }
      } catch (ex) {
        err = ex
      }

      expect(err).toBe(null)
      expect(config).toEqual({
        configType: 'game-config',
        meta: {
          name: 'Mock Game',
          mode: 'Teams',
          maxPlayers: 4,
          worldLimits: {
            x: 200,
            y: 200
          },
          teams: [
            {
              name: 'one',
              spawnPosition: { x: 0, y: 0 },
              description: 'Team one.'
            },
            {
              name: 'two',
              spawnPosition: { x: 200, y: 200 },
              description: 'Team two.'
            }
          ],
          tileType: 'grass'
        },
        description: 'This is the first mock game config.'
      })
    })
  })
  describe('the .loadFromFile() method,', () => {
    it('should throw an error for invalid or missing config file', async () => {
      const errors = []
      const games = []

      try {
        if (gameLoader instanceof GameLoader) {
          const config = await gameLoader.loadFromFile('i-dont-exist.json', 'asopfijdaspioj')
          games.push(config)
        }
      } catch (ex) {
        errors.push(ex)
      }
      try {
        if (gameLoader instanceof GameLoader) {
          const config = await gameLoader.loadFromFile('invalid-config.json', 'afii3i2l.do')
          games.push(config)
        }
      } catch (ex) {
        errors.push(ex)
      }

      expect(games.length).toBe(0)
      expect(errors.length).toBe(2)
      expect(errors[0]).toBeInstanceOf(Error)
      expect(errors[0].code).toBe('ENOENT')
      expect(errors[1]).toBeInstanceOf(TypeError)
    })
    it('should create a game if config file is valid', async () => {
      let game = null
      let err = null

      try {
        if (gameLoader instanceof GameLoader) {
          game = await gameLoader.loadFromFile('valid-config.json', 'f9092..fid0sccc0da')
        }
      } catch (ex) {
        err = ex
      }

      expect(err).toBe(null)
      expect(game).toBeInstanceOf(TeamGame)
    })
  })
})
