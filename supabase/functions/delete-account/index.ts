import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Verify JWT
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Use service role client for admin operations
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

  // Delete objects the user created on OTHER people's boards
  const { error: foreignObjErr } = await adminClient
    .from('board_objects')
    .delete()
    .eq('created_by', user.id)
  if (foreignObjErr) {
    return new Response(JSON.stringify({ error: `Failed to delete user objects: ${foreignObjErr.message}` }), {
      status: 500, headers: jsonHeaders,
    })
  }

  // Delete remaining objects on the user's own boards (created by collaborators)
  const { data: userBoards } = await adminClient
    .from('boards')
    .select('id')
    .eq('created_by', user.id)

  if (userBoards && userBoards.length > 0) {
    const boardIds = userBoards.map((b: { id: string }) => b.id)
    const { error: boardObjErr } = await adminClient.from('board_objects').delete().in('board_id', boardIds)
    if (boardObjErr) {
      return new Response(JSON.stringify({ error: `Failed to delete board objects: ${boardObjErr.message}` }), {
        status: 500, headers: jsonHeaders,
      })
    }
  }

  // Delete user's boards
  const { error: boardsErr } = await adminClient.from('boards').delete().eq('created_by', user.id)
  if (boardsErr) {
    return new Response(JSON.stringify({ error: `Failed to delete boards: ${boardsErr.message}` }), {
      status: 500, headers: jsonHeaders,
    })
  }

  // Delete the auth user
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)
  if (deleteError) {
    return new Response(JSON.stringify({ error: 'Failed to delete account' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
