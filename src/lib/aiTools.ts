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
    let args: Record<string, unknown>
    try {
      args = JSON.parse(tc.function.arguments)
    } catch {
      console.error(`AI tool call "${tc.function.name}" had invalid JSON arguments, skipping`)
      continue
    }

    try {
      switch (tc.function.name) {
        case 'createStickyNote': {
          const obj = buildObject(
            boardId,
            userId,
            'sticky_note',
            args.x as number,
            args.y as number,
            (args.width as number) ?? 200,
            (args.height as number) ?? 200,
            { text: args.text, color: (args.color as string) ?? '#fef08a' },
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
            args.x as number,
            args.y as number,
            (args.width as number) ?? 150,
            (args.height as number) ?? 100,
            {
              fillColor: (args.fillColor as string) ?? '#3b82f6',
              strokeColor: (args.strokeColor as string) ?? '#1e293b',
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
            args.x as number,
            args.y as number,
            (args.width as number) ?? 400,
            (args.height as number) ?? 300,
            { label: (args.label as string) ?? '' },
          )
          addObject(obj)
          await insertObject(obj)
          break
        }

        case 'createConnector': {
          const w = Math.abs((args.toX as number) - (args.fromX as number)) || 1
          const h = Math.abs((args.toY as number) - (args.fromY as number)) || 1
          const obj = buildObject(
            boardId,
            userId,
            'connector',
            Math.min(args.fromX as number, args.toX as number),
            Math.min(args.fromY as number, args.toY as number),
            w,
            h,
            {
              fromX: args.fromX,
              fromY: args.fromY,
              toX: args.toX,
              toY: args.toY,
              color: (args.color as string) ?? '#1e293b',
            },
          )
          addObject(obj)
          await insertObject(obj)
          break
        }

        case 'moveObject': {
          const changes = { x: args.x as number, y: args.y as number, updated_at: new Date().toISOString() }
          updateObject(args.objectId as string, changes)
          await patchObject(args.objectId as string, changes)
          break
        }

        case 'resizeObject': {
          const changes = {
            width: args.width as number,
            height: args.height as number,
            updated_at: new Date().toISOString(),
          }
          updateObject(args.objectId as string, changes)
          await patchObject(args.objectId as string, changes)
          break
        }

        case 'updateText': {
          const existing = useBoardStore
            .getState()
            .objects.find((o) => o.id === args.objectId)
          if (!existing) break
          const newProps = { ...existing.properties, text: args.text }
          const changes = { properties: newProps, updated_at: new Date().toISOString() }
          updateObject(args.objectId as string, changes)
          await patchObject(args.objectId as string, changes)
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
          updateObject(args.objectId as string, changes)
          await patchObject(args.objectId as string, changes)
          break
        }

        case 'deleteObject': {
          removeObject(args.objectId as string)
          await deleteObject(args.objectId as string)
          break
        }

        case 'getBoardState':
          // No-op — backend already received state with the request
          break
      }
    } catch (err) {
      console.error(`AI tool call "${tc.function.name}" failed:`, err)
    }
  }
}
