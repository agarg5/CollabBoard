import { create } from 'zustand'
import type { Board } from '../types/board'
import { supabase } from '../lib/supabase'

interface BoardListState {
  boards: Board[]
  loading: boolean
  fetchBoards: (userId: string) => Promise<void>
  createBoard: (name: string, userId: string) => Promise<Board | null>
  deleteBoard: (id: string) => Promise<boolean>
}

export const useBoardListStore = create<BoardListState>((set, get) => ({
  boards: [],
  loading: false,

  fetchBoards: async (_userId: string) => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch boards:', error.message)
      set({ loading: false })
      return
    }

    set({ boards: data ?? [], loading: false })
  },

  createBoard: async (name: string, userId: string) => {
    const { data, error } = await supabase
      .from('boards')
      .insert({ name, created_by: userId })
      .select()
      .single()

    if (error) {
      console.error('Failed to create board:', error.message)
      return null
    }

    set({ boards: [data, ...get().boards] })
    return data
  },

  deleteBoard: async (id: string) => {
    const { error } = await supabase
      .from('boards')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Failed to delete board:', error.message)
      return false
    }

    // Verify the board was actually deleted (RLS may silently prevent it)
    const { data: remaining } = await supabase
      .from('boards')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (remaining) {
      console.error('Failed to delete board: still exists after delete (RLS may have blocked it)')
      return false
    }

    set({ boards: get().boards.filter((b) => b.id !== id) })
    return true
  },
}))
