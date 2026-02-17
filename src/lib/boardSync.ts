import { supabase } from './supabase'
import type { BoardObject } from '../types/board'

export async function fetchObjects(boardId: string): Promise<BoardObject[]> {
  const { data, error } = await supabase
    .from('board_objects')
    .select('*')
    .eq('board_id', boardId)
    .order('z_index', { ascending: true })

  if (error) throw error
  return data as BoardObject[]
}

export async function insertObject(obj: BoardObject): Promise<void> {
  const { error } = await supabase.from('board_objects').insert(obj)
  if (error) throw error
}

export async function patchObject(
  id: string,
  changes: Partial<BoardObject>,
): Promise<void> {
  const { error } = await supabase
    .from('board_objects')
    .update(changes)
    .eq('id', id)

  if (error) throw error
}

export async function deleteObject(id: string): Promise<void> {
  const { error } = await supabase.from('board_objects').delete().eq('id', id)
  if (error) throw error
}
