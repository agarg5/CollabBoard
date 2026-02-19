import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

if (import.meta.env.VITE_DEV_BYPASS_AUTH === 'true') {
  ;(window as unknown as Record<string, unknown>).__supabase = supabase
}
