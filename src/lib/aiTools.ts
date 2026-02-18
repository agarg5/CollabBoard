import { useBoardStore } from '../store/boardStore'
import { insertObject, patchObject, deleteObject } from './boardSync'
import type { BoardObject, AiToolCall, ObjectType } from '../types/board'

function nextZIndex(): number {
  const objects = useBoardStore.getState().objects
  return objects.reduce((max, o) => Math.max(max, o.z_index), 0) + 1
}

function buildObject(
  boardId: string,
  userId: string,
  type: ObjectType,
  x: number,
  y: number,
  width: number,
  height: number,
  properties: Record<string, unknown>,
): BoardObject {
  return {
    id: crypto.randomUUID(),
    board_id: boardId,
    type,
    x,
    y,
    width,
    height,
    properties,
    z_index: nextZIndex(),
    created_by: userId,
    updated_at: new Date().toISOString(),
  }
}

export async function executeToolCalls(
  toolCalls: AiToolCall[],
  boardId: string,
  userId: string,
): Promise<void> {
  const { addObject, updateObject, removeObject } = useBoardStore.getState()

  for (const tc of toolCalls) {
    const args = JSON.parse(tc.function.arguments)

    switch (tc.function.name) {
      case 'createStickyNote': {
        const obj = buildObject(
          boardId,
          userId,
          'sticky_note',
          args.x,
          args.y,
          args.width ?? 200,
          args.height ?? 200,
          { text: args.text, color: args.color ?? '#fef08a' },
        )
        addObject(obj)
        await insertObject(obj)
        break
      }

      case 'createShape': {
        const obj = buildObject(
          boardId,
          userId,
          args.shapeType as ObjectType,
          args.x,
          args.y,
          args.width ?? 150,
          args.height ?? 100,
          {
            fillColor: args.fillColor ?? '#3b82f6',
            strokeColor: args.strokeColor ?? '#1e293b',
            strokeWidth: 2,
          },
        )
        addObject(obj)
        await insertObject(obj)
        break
      }

      case 'createFrame': {
        const obj = buildObject(
          boardId,
          userId,
          'frame',
          args.x,
          args.y,
          args.width ?? 400,
          args.height ?? 300,
          { label: args.label ?? '' },
        )
        addObject(obj)
        await insertObject(obj)
        break
      }

      case 'createConnector': {
        const w = Math.abs(args.toX - args.fromX) || 1
        const h = Math.abs(args.toY - args.fromY) || 1
        const obj = buildObject(
          boardId,
          userId,
          'connector',
          Math.min(args.fromX, args.toX),
          Math.min(args.fromY, args.toY),
          w,
          h,
          {
            fromX: args.fromX,
            fromY: args.fromY,
            toX: args.toX,
            toY: args.toY,
            color: args.color ?? '#1e293b',
          },
        )
        addObject(obj)
        await insertObject(obj)
        break
      }

      case 'moveObject': {
        const changes = { x: args.x, y: args.y, updated_at: new Date().toISOString() }
        updateObject(args.objectId, changes)
        await patchObject(args.objectId, changes)
        break
      }

      case 'resizeObject': {
        const changes = {
          width: args.width,
          height: args.height,
          updated_at: new Date().toISOString(),
        }
        updateObject(args.objectId, changes)
        await patchObject(args.objectId, changes)
        break
      }

      case 'updateText': {
        const existing = useBoardStore
          .getState()
          .objects.find((o) => o.id === args.objectId)
        if (!existing) break
        const newProps = { ...existing.properties, text: args.text }
        const changes = { properties: newProps, updated_at: new Date().toISOString() }
        updateObject(args.objectId, changes)
        await patchObject(args.objectId, changes)
        break
      }

      case 'changeColor': {
        const existing = useBoardStore
          .getState()
          .objects.find((o) => o.id === args.objectId)
        if (!existing) break
        const colorKey = existing.type === 'sticky_note' ? 'color' : 'fillColor'
        const newProps = { ...existing.properties, [colorKey]: args.color }
        const changes = { properties: newProps, updated_at: new Date().toISOString() }
        updateObject(args.objectId, changes)
        await patchObject(args.objectId, changes)
        break
      }

      case 'deleteObject': {
        removeObject(args.objectId)
        await deleteObject(args.objectId)
        break
      }

      case 'getBoardState':
        // No-op — backend already received state with the request
        break
    }
  }
}
