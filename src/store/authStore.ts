import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const DEV_BYPASS_AUTH =
  import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'

function getDevUser(): User {
  const overrideId =
    typeof window !== 'undefined'
      ? localStorage.getItem('DEV_USER_ID')
      : null
  const id = overrideId || '00000000-0000-0000-0000-000000000000'
  const suffix = id.slice(-4)
  return {
    id,
    email: `dev-${suffix}@collabboard.local`,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: { full_name: `Dev User ${suffix}` },
    created_at: new Date().toISOString(),
  } as unknown as User
}

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<string | null>
  signUpWithEmail: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<string | null>
  updateEmail: (email: string) => Promise<string | null>
  updatePassword: (password: string) => Promise<string | null>
  initialize: () => () => void
}

/** Returns the current user's ID if it's a valid UUID, otherwise null. */
export function getValidUserId(): string | null {
  const rawId = useAuthStore.getState().user?.id
  return rawId && /^[0-9a-f-]{36}$/i.test(rawId) ? rawId : null
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,

  signInWithGoogle: async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })
  },

  signInWithEmail: async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  },

  signUpWithEmail: async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return error?.message ?? null
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null })
  },

  updateEmail: async (email: string) => {
    const { error } = await supabase.auth.updateUser({ email })
    return error?.message ?? null
  },

  updatePassword: async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    return error?.message ?? null
  },

  deleteAccount: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return 'Not authenticated'

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      },
    )

    if (!response.ok) {
      const body = await response.json()
      return body.error ?? 'Failed to delete account'
    }

    await supabase.auth.signOut()
    set({ user: null, session: null })
    return null
  },

  initialize: () => {
    if (DEV_BYPASS_AUTH) {
      set({ user: getDevUser(), session: null, loading: false })
      return () => {}
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ session, user: session?.user ?? null, loading: false })
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null, loading: false })
    })

    return () => subscription.unsubscribe()
  },
}))
