import { describe, it, expect } from 'vitest'
import { parseBoardJson } from '../../src/lib/boardJson'

const validObj = { type: 'sticky_note', x: 10, y: 20, properties: { text: 'hi' } }

function parse(input: unknown, maxZ = 0) {
  return parseBoardJson(JSON.stringify(input), 'board-1', 'user-1', maxZ)
}

describe('parseBoardJson', () => {
  it('parses versioned export format', () => {
    const result = parse({ version: 1, exportedAt: '2024-01-01', objects: [validObj] })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      board_id: 'board-1',
      created_by: 'user-1',
      type: 'sticky_note',
      x: 10,
      y: 20,
      width: 150,
      height: 150,
      z_index: 1,
      rotation: 0,
      properties: { text: 'hi' },
    })
    expect(result[0].id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('parses bare array format', () => {
    const result = parse([validObj])
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('sticky_note')
  })

  it('regenerates IDs and assigns z_index from existingMaxZ', () => {
    const input = [
      { ...validObj, id: 'old-id-1', z_index: 999 },
      { ...validObj, id: 'old-id-2', z_index: 999 },
    ]
    const result = parse(input, 50)
    expect(result[0].id).not.toBe('old-id-1')
    expect(result[1].id).not.toBe('old-id-2')
    expect(result[0].z_index).toBe(51)
    expect(result[1].z_index).toBe(52)
  })

  it('defaults width/height to 150 and rotation to 0', () => {
    const result = parse([validObj])
    expect(result[0]).toMatchObject({ width: 150, height: 150, rotation: 0 })
  })

  it('preserves explicit width/height/rotation', () => {
    const result = parse([{ ...validObj, width: 300, height: 400, rotation: 45 }])
    expect(result[0]).toMatchObject({ width: 300, height: 400, rotation: 45 })
  })

  it('defaults properties to empty object when omitted', () => {
    const result = parse([{ type: 'rectangle', x: 0, y: 0 }])
    expect(result[0].properties).toEqual({})
  })

  it('rejects invalid JSON', () => {
    expect(() => parseBoardJson('not json', 'b', 'u', 0)).toThrow()
  })

  it('rejects non-object/non-array', () => {
    expect(() => parse('hello')).toThrow('expected an object')
  })

  it('rejects missing type', () => {
    expect(() => parse([{ x: 0, y: 0 }])).toThrow('invalid or missing type')
  })

  it('rejects invalid type', () => {
    expect(() => parse([{ type: 'bogus', x: 0, y: 0 }])).toThrow('invalid or missing type')
  })

  it('rejects missing coordinates', () => {
    expect(() => parse([{ type: 'circle' }])).toThrow('missing x/y')
  })

  it('rejects negative width', () => {
    expect(() => parse([{ ...validObj, width: -10 }])).toThrow('invalid width')
  })

  it('rejects array properties', () => {
    expect(() => parse([{ ...validObj, properties: [1, 2] }])).toThrow('properties must be an object')
  })

  it('accepts all valid object types', () => {
    const types = ['sticky_note', 'rectangle', 'circle', 'line', 'connector', 'frame', 'text']
    const objects = types.map((type) => ({ type, x: 0, y: 0 }))
    expect(parse(objects)).toHaveLength(7)
  })
})
