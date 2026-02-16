import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}))

import { useAuthStore } from './authStore'
import { supabase } from '../lib/supabase'

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, session: null, loading: true })
  })

  it('starts with no user and loading true', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.loading).toBe(true)
  })

  it('calls supabase signInWithOAuth on signInWithGoogle', async () => {
    await useAuthStore.getState().signInWithGoogle()
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  })

  it('clears user on signOut', async () => {
    useAuthStore.setState({ user: { id: '123' } as never, session: {} as never })
    await useAuthStore.getState().signOut()
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().session).toBeNull()
  })

  it('initializes and sets loading to false', async () => {
    useAuthStore.getState().initialize()
    await vi.waitFor(() => {
      expect(useAuthStore.getState().loading).toBe(false)
    })
  })
})
