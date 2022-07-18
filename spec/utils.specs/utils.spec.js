/* eslint-env jasmine */
/**
 * @fileoverview Testing application utility methods.
 */

import * as utils from '../../lib/utils/utils.js'

describe('The Colonial Wars basic utility object,', () => {
  it('should have four properties', () => {
    const utilsLength = Object.keys(utils).length

    expect(utilsLength).toBe(4)
  })
  it('should have three functions, one symbol', () => {
    const utilVals = Object.values(utils)
    let numFuncs = 0
    let numSymbols = 0
    utilVals.forEach(val => {
      switch (typeof val) {
        case 'function':
          numFuncs++
          break
        case 'symbol':
          numSymbols++
          break
      }
    })

    expect(numFuncs).toBe(3)
    expect(numSymbols).toBe(1)
  })

  it('should be able to deep-freeze objects', () => {
    const obj = {
      foo: 'bar',
      baz: 'quaxx',
      cheese: 'I don\'t like it.',
      deep: {
        deepdeep: {
          depth: 'deeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeep'
        }
      }
    }
    const errors = []
    try {
      utils.deepFreeze(obj)
      errors.push(null)
    } catch (ex) {
      errors.push(ex)
    }
    Object.keys(obj).forEach(key => {
      try {
        obj[key] = null
      } catch (ex) {
        errors.push(ex)
      }
    })

    expect(errors.shift()).toBe(null)
    expect(errors.every(val => val instanceof TypeError)).toBe(true)
  })

  it('should be able to detect if a string is lowercase', () => {
    const strings = [
      'I_AM_NOT_LOWERCASE',
      'i_am_lower_case',
      '...'
    ]
    const results = []

    strings.forEach(str => {
      results.push(utils.isLowerCase(str))
    })

    expect(results[0]).toBe(false)
    expect(results[1]).toBe(true)
    expect(results[2]).toBe(false)
  })

  it('should be able to filter the process.env object', () => {
    const env = process.env
    const filteredEnv = utils.filterEnv(env)

    expect(Object.keys(filteredEnv).every(key => !utils.isLowerCase(key))).toBe(true)
  })
})
