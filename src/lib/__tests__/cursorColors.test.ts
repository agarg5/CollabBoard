import { describe, it, expect } from 'vitest'
import { getCursorColor } from '../cursorColors'

describe('getCursorColor', () => {
  it('returns a valid hex color', () => {
    const color = getCursorColor('user-123')
    expect(color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('is deterministic for the same user_id', () => {
    const a = getCursorColor('user-abc')
    const b = getCursorColor('user-abc')
    expect(a).toBe(b)
  })

  it('returns different colors for different user_ids', () => {
    const colors = new Set(
      ['alice', 'bob', 'carol', 'dave', 'eve', 'frank', 'grace', 'heidi'].map(getCursorColor),
    )
    expect(colors.size).toBeGreaterThan(1)
  })
})
