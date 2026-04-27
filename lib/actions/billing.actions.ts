// lib/actions/billing.actions.ts
// Server actions for billing page
// Uses service role for reads since users can only see their own data
// Clerk handles the actual plan changes — we just read our mirror tables
//related with webhooks
'use server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

// Service role for server-side reads — never exposed to client
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─────────────────────────────────────────────────────────────────────────────
// getCurrentSubscription
// Returns the user's current subscription row or null
// ─────────────────────────────────────────────────────────────────────────────
export async function getCurrentSubscription() {
  const { userId } = await auth()
  if (!userId) return null

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[billing.getCurrentSubscription] error:', error.message)
    return null
  }

  console.log(`[billing.getCurrentSubscription] userId=${userId} plan=${data?.plan ?? 'none'} status=${data?.status ?? 'none'}`)
  return data
}

// ─────────────────────────────────────────────────────────────────────────────
// getBillingHistory
// Returns all billing events for the user, newest first
// ─────────────────────────────────────────────────────────────────────────────
export async function getBillingHistory(limit = 20) {
  const { userId } = await auth()
  if (!userId) return []

  const { data, error } = await supabaseAdmin
    .from('billing_events')
    .select('id, event_type, plan, status, amount_cents, currency, period_start, period_end, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[billing.getBillingHistory] error:', error.message)
    return []
  }

  console.log(`[billing.getBillingHistory] userId=${userId} found ${data?.length ?? 0} events`)
  return data || []
}

// ─────────────────────────────────────────────────────────────────────────────
// getUserProfile
// Returns the user row from public.users
// ─────────────────────────────────────────────────────────────────────────────
export async function getUserProfile() {
  const { userId } = await auth()
  if (!userId) return null

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, first_name, last_name, pfp, phone, created_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('[billing.getUserProfile] error:', error.message)
    return null
  }

  return data
}