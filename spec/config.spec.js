/* eslint-env jasmine */
/**
 * @fileoverview Test Configurations class.
 */

const path = require('path')
const Configurations = require('../lib/utils/configurations')

describe('The Configurations class, when used without a file input,', () => {
  let configurations = null
  let err = null

  it('should construct without error', () => {
    try {
      configurations = new Configurations({
        crud: [
          'cREATE', 'rEAD', 'uPDATE', 'dELETE'
        ],
        data: {
          trash: true,
          recyclable: false,
          message: "Don't recycle this trash."
        }
      })
    } catch (ex) {
      err = ex
    }

    expect(err).toBe(null)
    expect(configurations).toBeInstanceOf(Configurations)
  })

  it('should get existing properties and return them', () => {
    let val = null

    if (configurations instanceof Configurations) {
      val = configurations.get('crud')
    }
    expect(val).not.toBe(null)
  })

  it('should return null for non-existing properties', () => {
    let val = null

    if (configurations instanceof Configurations) {
      val = configurations.get('i', "don't", 'exist')
    }
    expect(val).toBe(null)
  })
})

describe('The Configurations class, when used with a file input,', () => {
  let configurations = null
  let err = null

  it('should create without error', async () => {
    try {
      configurations = await Configurations.readFrom(
        path.join(__dirname, 'mocks/external', 'mock-config.json')
      )
    } catch (er) {
      err = er
    }
    expect(err).toBe(null)
    expect(configurations).toBeInstanceOf(Configurations)
  })

  it('should get existing properties and return them', () => {
    let vals = null

    if (configurations instanceof Configurations) {
      vals = []
      vals.push(configurations.get('This'))

      vals.push(configurations.get('mock'))
    }
    expect(vals).not.toBe(null)
    expect(vals).toHaveSize(2)
  })

  it('should return null for non-existing properties', () => {
    let val = null

    if (configurations instanceof Configurations) {
      val = configurations.get('i', 'still', "don't", 'exist')
    }
    expect(val).toBe(null)
  })
})

describe('The Configurations class, when used with fallbacks,', () => {
  let configurations = null
  let err = null

  it('should create without error, even if the file path is not valid', async () => {
    try {
      configurations = await Configurations.readFrom(
        '',
        { fellback: true, That: 'Not this, THAT' }
      )
    } catch (er) {
      err = er
    }
    expect(err).toBe(null)
    expect(configurations).toBeInstanceOf(Configurations)
  })

  it('should get existing properties and return them', () => {
    let vals = null

    if (configurations instanceof Configurations) {
      vals = []
      vals.push(configurations.get('That'))

      vals.push(configurations.get('fellback'))
    }
    expect(vals).not.toBe(null)
    expect(vals).toHaveSize(2)
  })

  it('should return null for non-existing properties', () => {
    let val = null

    if (configurations instanceof Configurations) {
      val = configurations.get('i', 'am', 'a', 'teapot')
    }
    expect(val).toBe(null)
  })
})

describe('The Configurations class, when creating with multiple input objects,', () => {
  let configurations = null

  it('should create without error', () => {
    let err = null

    try {
      configurations = Configurations.from(
        { i: 11 }, { data: { trash: true, recyclable: false, message: "Don't recycle this trash." } },
        { crud: ['cREATE', 'rEAD', 'uPDATE', 'dELETE'] }, { ISHALLKILLYOU: true, kYouAreDead: false }
      )
    } catch (ex) {
      err = ex
    }

    expect(err).toBe(null)
    expect(configurations).toBeInstanceOf(Configurations)
  })

  it('should get existing properties and return them', () => {
    const vals = []

    if (configurations instanceof Configurations) {
      vals.push(configurations.get('i'))
      vals.push(configurations.get('data', 'trash'))
      vals.push(configurations.get('crud'))
      vals.push(configurations.get('kYouAreDead'))
    }

    expect(vals[0]).toBe(11)
    expect(vals[1]).toBe(true)
    expect(vals[2]).toBeInstanceOf(Array)
    expect(vals[2]).toContain('cREATE')
    expect(vals[3]).toBe(false)
  })

  it('should return null for non-existent properties', () => {
    let val = null

    if (configurations instanceof Configurations) {
      val = configurations.get('i', 'am', 'non', 'existent')
    }

    expect(val).toBe(null)
  })
})
