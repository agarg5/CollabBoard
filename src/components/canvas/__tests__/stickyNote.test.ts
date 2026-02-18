import { describe, it, expect, beforeEach } from 'vitest'
import { useBoardStore } from '../../../store/boardStore'
import type { BoardObject } from '../../../types/board'

function createStickyNote(overrides: Partial<BoardObject> = {}): BoardObject {
  return {
    id: crypto.randomUUID(),
    board_id: '',
    type: 'sticky_note',
    properties: { text: '', color: '#fef08a' },
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    z_index: 0,
    rotation: 0,
    created_by: '',
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('sticky note creation', () => {
  beforeEach(() => {
    useBoardStore.setState({ objects: [], selectedIds: [] })
  })

  it('creates a sticky note with default properties', () => {
    const note = createStickyNote()
    expect(note.type).toBe('sticky_note')
    expect(note.properties.text).toBe('')
    expect(note.properties.color).toBe('#fef08a')
    expect(note.width).toBe(200)
    expect(note.height).toBe(200)
  })

  it('creates a sticky note with custom position', () => {
    const note = createStickyNote({ x: 150, y: 250 })
    expect(note.x).toBe(150)
    expect(note.y).toBe(250)
  })

  it('adds a sticky note to the board store', () => {
    const note = createStickyNote()
    useBoardStore.getState().addObject(note)
    expect(useBoardStore.getState().objects).toHaveLength(1)
    expect(useBoardStore.getState().objects[0].id).toBe(note.id)
  })
})

describe('sticky note color update', () => {
  beforeEach(() => {
    useBoardStore.setState({ objects: [], selectedIds: [] })
  })

  it('updates color via updateObject', () => {
    const note = createStickyNote()
    useBoardStore.getState().addObject(note)

    useBoardStore.getState().updateObject(note.id, {
      properties: { ...note.properties, color: '#fda4af' },
    })

    const updated = useBoardStore.getState().objects[0]
    expect(updated.properties.color).toBe('#fda4af')
  })

  it('preserves text when changing color', () => {
    const note = createStickyNote({
      properties: { text: 'Hello', color: '#fef08a' },
    })
    useBoardStore.getState().addObject(note)

    useBoardStore.getState().updateObject(note.id, {
      properties: { ...note.properties, color: '#93c5fd' },
    })

    const updated = useBoardStore.getState().objects[0]
    expect(updated.properties.text).toBe('Hello')
    expect(updated.properties.color).toBe('#93c5fd')
  })
})

describe('sticky note text update', () => {
  beforeEach(() => {
    useBoardStore.setState({ objects: [], selectedIds: [] })
  })

  it('updates text via updateObject', () => {
    const note = createStickyNote()
    useBoardStore.getState().addObject(note)

    useBoardStore.getState().updateObject(note.id, {
      properties: { ...note.properties, text: 'New text' },
    })

    const updated = useBoardStore.getState().objects[0]
    expect(updated.properties.text).toBe('New text')
  })

  it('preserves color when changing text', () => {
    const note = createStickyNote({
      properties: { text: '', color: '#86efac' },
    })
    useBoardStore.getState().addObject(note)

    useBoardStore.getState().updateObject(note.id, {
      properties: { ...note.properties, text: 'Updated' },
    })

    const updated = useBoardStore.getState().objects[0]
    expect(updated.properties.color).toBe('#86efac')
    expect(updated.properties.text).toBe('Updated')
  })
})
