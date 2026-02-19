import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
      updateUser: vi.fn().mockResolvedValue({ data: { user: {} }, error: null }),
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

  it('calls supabase resetPasswordForEmail and returns null on success', async () => {
    const result = await useAuthStore.getState().resetPasswordForEmail('test@example.com')
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('test@example.com', {
      redirectTo: window.location.origin,
    })
    expect(result).toBeNull()
  })

  it('returns error message when resetPasswordForEmail fails', async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValueOnce({
      data: {},
      error: { message: 'User not found', name: 'AuthError', status: 400 },
    } as never)
    const result = await useAuthStore.getState().resetPasswordForEmail('bad@example.com')
    expect(result).toBe('User not found')
  })

  describe('updateEmail', () => {
    it('calls supabase updateUser with email and returns null on success', async () => {
      const result = await useAuthStore.getState().updateEmail('new@example.com')
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ email: 'new@example.com' })
      expect(result).toBeNull()
    })

    it('returns error message on failure', async () => {
      vi.mocked(supabase.auth.updateUser).mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Email already in use', name: 'AuthApiError', status: 422 },
      } as never)
      const result = await useAuthStore.getState().updateEmail('taken@example.com')
      expect(result).toBe('Email already in use')
    })
  })

  describe('updatePassword', () => {
    it('calls supabase updateUser with password and returns null on success', async () => {
      const result = await useAuthStore.getState().updatePassword('newpass123')
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'newpass123' })
      expect(result).toBeNull()
    })

    it('returns error message on failure', async () => {
      vi.mocked(supabase.auth.updateUser).mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Password too short', name: 'AuthApiError', status: 422 },
      } as never)
      const result = await useAuthStore.getState().updatePassword('short')
      expect(result).toBe('Password too short')
    })
  })
})
