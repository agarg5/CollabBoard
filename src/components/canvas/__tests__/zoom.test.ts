import { describe, it, expect } from 'vitest'
import { calculateZoom } from '../zoomHelper'

describe('calculateZoom', () => {
  const center = { x: 500, y: 400 }
  const origin = { x: 0, y: 0 }

  it('zooms in on negative deltaY (scroll up)', () => {
    const result = calculateZoom(-100, center.x, center.y, 1, origin)
    expect(result.scale).toBeGreaterThan(1)
  })

  it('zooms out on positive deltaY (scroll down)', () => {
    const result = calculateZoom(100, center.x, center.y, 1, origin)
    expect(result.scale).toBeLessThan(1)
  })

  it('keeps the cursor world point fixed after zoom in', () => {
    const scale = 1
    const pos = { x: 50, y: 30 }
    const pointer = { x: 400, y: 300 }

    // World point under cursor before zoom
    const worldX = (pointer.x - pos.x) / scale
    const worldY = (pointer.y - pos.y) / scale

    const result = calculateZoom(-100, pointer.x, pointer.y, scale, pos)

    // World point under cursor after zoom
    const newWorldX = (pointer.x - result.position.x) / result.scale
    const newWorldY = (pointer.y - result.position.y) / result.scale

    expect(newWorldX).toBeCloseTo(worldX, 5)
    expect(newWorldY).toBeCloseTo(worldY, 5)
  })

  it('keeps the cursor world point fixed after zoom out', () => {
    const scale = 2
    const pos = { x: -100, y: -200 }
    const pointer = { x: 600, y: 500 }

    const worldX = (pointer.x - pos.x) / scale
    const worldY = (pointer.y - pos.y) / scale

    const result = calculateZoom(100, pointer.x, pointer.y, scale, pos)

    const newWorldX = (pointer.x - result.position.x) / result.scale
    const newWorldY = (pointer.y - result.position.y) / result.scale

    expect(newWorldX).toBeCloseTo(worldX, 5)
    expect(newWorldY).toBeCloseTo(worldY, 5)
  })

  it('clamps scale at minimum (0.1)', () => {
    const result = calculateZoom(100, center.x, center.y, 0.1, origin)
    expect(result.scale).toBeGreaterThanOrEqual(0.1)
  })

  it('clamps scale at maximum (5)', () => {
    const result = calculateZoom(-100, center.x, center.y, 5, origin)
    expect(result.scale).toBeLessThanOrEqual(5)
  })

  it('returns unchanged scale when already at min and zooming out', () => {
    const result = calculateZoom(100, center.x, center.y, 0.1, origin)
    expect(result.scale).toBeCloseTo(0.1, 2)
  })

  it('returns unchanged scale when already at max and zooming in', () => {
    const result = calculateZoom(-100, center.x, center.y, 5, origin)
    expect(result.scale).toBeCloseTo(5, 2)
  })
})
