import { describe, it, expect, beforeEach } from 'vitest'
import { useBoardStore } from '../../src/store/boardStore'
import type { BoardObject } from '../../src/types/board'

function makeObject(i: number): BoardObject {
  return {
    id: `obj-${i}`,
    board_id: 'board-1',
    type: 'sticky_note',
    properties: { text: `Note ${i}`, color: '#fef08a' },
    x: 100 + (i % 25) * 220,
    y: 100 + Math.floor(i / 25) * 220,
    width: 200,
    height: 200,
    z_index: i,
    created_by: null,
    updated_at: new Date().toISOString(),
  }
}

describe('Board store performance', () => {
  beforeEach(() => {
    useBoardStore.setState({
      boardId: 'board-1',
      objects: [],
      selectedIds: [],
      clipboard: [],
      pasteCount: 0,
    })
  })

  it('addObject x500 completes in <100ms', () => {
    const start = performance.now()
    for (let i = 0; i < 500; i++) {
      useBoardStore.getState().addObject(makeObject(i))
    }
    const elapsed = performance.now() - start

    console.log(`addObject x500: ${elapsed.toFixed(1)}ms`)
    expect(useBoardStore.getState().objects.length).toBe(500)
    expect(elapsed).toBeLessThan(100)
  })

  it('updateObject with 500 existing objects completes in <50ms', () => {
    // Pre-fill 500 objects
    useBoardStore.setState({
      objects: Array.from({ length: 500 }, (_, i) => makeObject(i)),
    })

    const start = performance.now()
    // Update object in the middle
    useBoardStore.getState().updateObject('obj-250', { x: 999, y: 999 })
    const elapsed = performance.now() - start

    console.log(`updateObject with 500 objects: ${elapsed.toFixed(3)}ms`)
    const updated = useBoardStore.getState().objects.find((o) => o.id === 'obj-250')
    expect(updated?.x).toBe(999)
    expect(elapsed).toBeLessThan(50)
  })

  it('setObjects bulk replace 500 objects completes in <10ms', () => {
    const objects = Array.from({ length: 500 }, (_, i) => makeObject(i))

    const start = performance.now()
    useBoardStore.getState().setObjects(objects)
    const elapsed = performance.now() - start

    console.log(`setObjects x500: ${elapsed.toFixed(3)}ms`)
    expect(useBoardStore.getState().objects.length).toBe(500)
    expect(elapsed).toBeLessThan(10)
  })

  it('removeObject with 500 existing objects completes in <50ms', () => {
    useBoardStore.setState({
      objects: Array.from({ length: 500 }, (_, i) => makeObject(i)),
    })

    const start = performance.now()
    useBoardStore.getState().removeObject('obj-250')
    const elapsed = performance.now() - start

    console.log(`removeObject with 500 objects: ${elapsed.toFixed(3)}ms`)
    expect(useBoardStore.getState().objects.length).toBe(499)
    expect(elapsed).toBeLessThan(50)
  })

  it('selectAll with 500 objects completes in <10ms', () => {
    useBoardStore.setState({
      objects: Array.from({ length: 500 }, (_, i) => makeObject(i)),
    })

    const start = performance.now()
    useBoardStore.getState().selectAll()
    const elapsed = performance.now() - start

    console.log(`selectAll x500: ${elapsed.toFixed(3)}ms`)
    expect(useBoardStore.getState().selectedIds.length).toBe(500)
    expect(elapsed).toBeLessThan(10)
  })
})
