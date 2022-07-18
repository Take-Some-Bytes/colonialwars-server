/* eslint-env jasmine */
/**
 * @fileoverview Specs for the MapConfig class, which handles loading and
 * validating map configurations.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const fs = require('fs')
const path = require('path')

const Vector2D = require('../../lib/game/physics/vector2d')
const MapConfig = require('../../lib/game/map-config.js')

describe('The MapConfig class,', () => {
  it('should not accept empty map configurations', () => {
    const config = ''

    expect(() => {
      /* eslint-disable-next-line no-new */
      new MapConfig(config)
    }).toThrow()
  })

  it('should not accept invalid JSON', () => {
    const config = '{ "NOT JSON" )'

    expect(() => {
      /* eslint-disable-next-line no-new */
      new MapConfig(config)
    }).toThrow()
  })

  it('should not accept an invalid configuration file', () => {
    const config = fs.readFileSync(path.join(__dirname, '../mocks/external/mock-game-confs/invalid-config2.json'))

    expect(() => {
      /* eslint-disable-next-line no-new */
      new MapConfig(config)
    }).toThrow()
  })

  it('should be read-only', () => {
    const filePath = path.join(__dirname, '../mocks/external/mock-game-confs/valid-config.json')
    const file = fs.readFileSync(filePath)
    const config = new MapConfig(file)

    expect(config.graphics).not.toBeFalsy()
    expect(config.modifiers).not.toBeFalsy()
    expect(config.player).not.toBeFalsy()

    expect(() => {
      'use strict'
      config.graphics.hi = 10
    }).toThrow()
    expect(() => {
      'use strict'
      config.modifiers.hi = 10
    }).toThrow()
    expect(() => {
      'use strict'
      config.player.hi = 10
    }).toThrow()
  })

  it('should have all the necessary props', () => {
    const filePath = path.join(__dirname, '../mocks/external/mock-game-confs/valid-config.json')
    const file = fs.readFileSync(filePath)
    const config = new MapConfig(file)

    expect(config.mode).toBe('teams')
    expect(config.tileType).toBe('grass')
    expect(config.maxPlayers).toBe(4)
    expect(config.defaultHeight).toBe(0)
    expect(config.description).toBeTruthy()
    expect(config.worldLimits).toEqual(new Vector2D(200, 200))
    expect(config.teams).toHaveSize(2)
    expect(config.graphics).toHaveSize(0)
    expect(config.modifiers).toHaveSize(0)
    expect(config.player).toHaveSize(0)
  })

  it('should be able to load map configs from a file', async () => {
    const filePath = path.join(__dirname, '../mocks/external/mock-game-confs/valid-config.json')
    const config = await MapConfig.fromFile(filePath)

    expect(config.mode).toBe('teams')
    expect(config.tileType).toBe('grass')
    expect(config.maxPlayers).toBe(4)
    expect(config.defaultHeight).toBe(0)
    expect(config.description).toBeTruthy()
    expect(config.worldLimits).toEqual(new Vector2D(200, 200))
    expect(config.teams).toHaveSize(2)
    expect(config.graphics).toHaveSize(0)
    expect(config.modifiers).toHaveSize(0)
    expect(config.player).toHaveSize(0)
  })
})
