// api/webhooks/clerk/route.ts
import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ✅ Service role key — bypasses RLS, safe ONLY in server-side webhook handler
// Never expose this key to the client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─────────────────────────────────────────────────────────────────────────────
// Clerk Billing payload helpers
//
// The previous version of this file read `sub.user_id`/`sub.plan_id` off the
// event payload directly — those fields don't exist on Clerk Billing events.
// Per Clerk's docs, the payer lives at `evt.data.payer.user_id` (or
// `.organization_id`), and the plan lives at `evt.data.items[i].plan.slug`
// for `subscription.*` events, or `evt.data.plan.slug` directly for
// `subscriptionItem.*` events (an item has no back-reference to its parent
// subscription id). Reading the wrong fields meant `userId` was always null
// (silently hitting the "missing_user_id" guard) or `plan` was always
// "unknown" — the mirror table never actually synced with real upgrades.
// ─────────────────────────────────────────────────────────────────────────────

function getUserId(data: any): string | null {
  return data?.payer?.user_id ?? data?.user_id ?? data?.userId ?? null
}

function getPlanSlug(data: any): string {
  return data?.plan?.slug ?? data?.items?.[0]?.plan?.slug ?? data?.plan_id ?? data?.plan_slug ?? 'unknown'
}

function toIso(unixSeconds: number | null | undefined): string | null {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null
}

// Upserts the ONE current-plan row for a user. Deliberately keyed by
// user_id (read-then-write) instead of `ON CONFLICT (id)` — Clerk's
// subscription id and subscriptionItem id are different values for the same
// user, so conflicting on `id` would leave multiple rows per user and
// getCurrentSubscription()'s single-row read would only ever see whichever
// happened to be inserted, unpredictably.
async function upsertUserSubscription(
  userId: string,
  fields: {
    plan: string
    status: string
    current_period_start: string | null
    current_period_end: string | null
    cancel_at_period_end: boolean
    cancelled_at: string | null
  },
  sourceId: string,
) {
  const { data: existing, error: findError } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (findError) {
    console.error('[webhook] subscriptions lookup error:', findError.message)
  }

  const payload = { user_id: userId, ...fields, updated_at: new Date().toISOString() }

  if (existing) {
    return supabase.from('subscriptions').update(payload).eq('id', existing.id)
  }
  return supabase.from('subscriptions').insert({ id: sourceId, ...payload })
}

async function logBillingEvent(userId: string, eventType: string, data: any, plan: string, status: string, subId: string) {
  const { error } = await supabase.from('billing_events').insert({
    user_id: userId,
    event_type: eventType,
    plan,
    status,
    amount_cents: data.amount_cents ?? null,
    currency: data.currency ?? 'usd',
    subscription_id: subId,
    period_start: toIso(data.current_period_start),
    period_end: toIso(data.current_period_end),
    raw_payload: data,
  })
  if (error) {
    console.error(`[webhook] ${eventType} — billing_events insert error:`, error.message)
  } else {
    console.log(`[webhook] ✅ ${eventType} — billing_event logged for userId=${userId}`)
  }
}

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req)
    const eventType = evt.type
    console.log(`[webhook] Received event: ${eventType}`)

    // ─────────────────────────────────────────────────────────────────────
    // USER CREATED
    // Seeds first_name/last_name/pfp from Clerk as a starting default — the
    // person can then rename themselves for this site from Settings without
    // that edit ever being overwritten (see user.updated below, which
    // deliberately never touches name fields).
    // ─────────────────────────────────────────────────────────────────────
    if (eventType === 'user.created') {
      const user = evt.data as any
      const primaryEmail =
        user.email_addresses?.find((e: any) => e.id === user.primary_email_address_id)?.email_address ??
        user.email_addresses?.[0]?.email_address ??
        null

      const { error } = await supabase.from('users').insert({
        id: user.id,
        email: primaryEmail,
        first_name: user.first_name ?? null,
        last_name: user.last_name ?? null,
        pfp: user.image_url ?? null,
      })

      if (error) {
        console.error('[webhook] user.created — DB insert error:', error.message)
        return new Response('db_error', { status: 500 })
      }

      console.log(`[webhook] ✅ user.created — inserted userId=${user.id}`)
      return new Response('ok')
    }

    // ─────────────────────────────────────────────────────────────────────
    // USER UPDATED
    // Keeps email/avatar in sync with Clerk. Deliberately does NOT touch
    // first_name/last_name — once someone has set a display name for this
    // site (via Settings), a Clerk-side profile edit must never clobber it.
    // ─────────────────────────────────────────────────────────────────────
    if (eventType === 'user.updated') {
      const user = evt.data as any
      const primaryEmail =
        user.email_addresses?.find((e: any) => e.id === user.primary_email_address_id)?.email_address ??
        user.email_addresses?.[0]?.email_address ??
        null

      // upsert (not update) — covers a user.updated arriving for someone who
      // signed up before this webhook was wired up and has no row yet.
      // Only email/pfp are in the payload, so an existing row's
      // first_name/last_name are left untouched on conflict.
      const { error } = await supabase
        .from('users')
        .upsert({ id: user.id, email: primaryEmail, pfp: user.image_url ?? null }, { onConflict: 'id' })

      if (error) {
        console.error('[webhook] user.updated — DB update error:', error.message)
        return new Response('db_error', { status: 500 })
      }

      console.log(`[webhook] ✅ user.updated — synced userId=${user.id}`)
      return new Response('ok')
    }

    // ─────────────────────────────────────────────────────────────────────
    // SUBSCRIPTION-LEVEL EVENTS — created / updated / active / pastDue
    // Fires on the top-level Subscription container. Plan comes from the
    // first line item (`items[0].plan.slug`).
    // ─────────────────────────────────────────────────────────────────────
    if (eventType === 'subscription.created' || eventType === 'subscription.updated' || eventType === 'subscription.active' || eventType === 'subscription.pastDue') {
      const sub = evt.data as any
      console.log(`[webhook] ${eventType} raw:`, JSON.stringify(sub, null, 2))

      const userId = getUserId(sub)
      if (!userId) {
        // Org-owned subscription, or a payload shape we don't recognize — nothing to mirror.
        console.warn(`[webhook] ${eventType} — no payer.user_id on payload, skipping`)
        return new Response('ok')
      }

      const plan = getPlanSlug(sub)
      const status = sub.status ?? (eventType === 'subscription.pastDue' ? 'past_due' : 'active')
      const cancelAtPeriodEnd = sub.cancel_at_period_end ?? false
      const cancelledAt = status === 'canceled' || cancelAtPeriodEnd ? toIso(sub.cancelled_at) ?? new Date().toISOString() : null

      const { error: subError } = await upsertUserSubscription(
        userId,
        {
          plan,
          status,
          current_period_start: toIso(sub.current_period_start),
          current_period_end: toIso(sub.current_period_end),
          cancel_at_period_end: cancelAtPeriodEnd,
          cancelled_at: cancelledAt,
        },
        sub.id,
      )

      if (subError) {
        console.error(`[webhook] ${eventType} — subscriptions upsert error:`, subError.message)
      } else {
        console.log(`[webhook] ✅ ${eventType} — synced userId=${userId} plan=${plan} status=${status}`)
      }

      let billingEventType: string = eventType
      if (status === 'past_due') billingEventType = 'subscription.past_due'
      if (cancelAtPeriodEnd) billingEventType = 'subscription.cancel_scheduled'

      await logBillingEvent(userId, billingEventType, sub, plan, status, sub.id)
      return new Response('ok')
    }

    // ─────────────────────────────────────────────────────────────────────
    // SUBSCRIPTION-ITEM EVENTS — active / updated / canceled / pastDue
    // Clerk Billing has no `subscription.canceled` — cancellation is an
    // item-level event. Items carry their own `plan.slug` directly (no
    // back-reference to the parent subscription id).
    // ─────────────────────────────────────────────────────────────────────
    if (
      eventType === 'subscriptionItem.active' ||
      eventType === 'subscriptionItem.updated' ||
      eventType === 'subscriptionItem.canceled' ||
      eventType === 'subscriptionItem.pastDue'
    ) {
      const item = evt.data as any
      console.log(`[webhook] ${eventType} raw:`, JSON.stringify(item, null, 2))

      const userId = getUserId(item)
      if (!userId) {
        console.warn(`[webhook] ${eventType} — no payer.user_id on payload, skipping`)
        return new Response('ok')
      }

      const plan = getPlanSlug(item)
      const status = eventType === 'subscriptionItem.canceled' ? 'canceled' : eventType === 'subscriptionItem.pastDue' ? 'past_due' : item.status ?? 'active'
      const cancelledAt = status === 'canceled' ? toIso(item.canceled_at) ?? new Date().toISOString() : null

      const { error: itemError } = await upsertUserSubscription(
        userId,
        {
          plan,
          status,
          current_period_start: toIso(item.current_period_start),
          current_period_end: toIso(item.current_period_end),
          cancel_at_period_end: status === 'canceled',
          cancelled_at: cancelledAt,
        },
        item.id,
      )

      if (itemError) {
        console.error(`[webhook] ${eventType} — subscriptions upsert error:`, itemError.message)
      } else {
        console.log(`[webhook] ✅ ${eventType} — synced userId=${userId} plan=${plan} status=${status}`)
      }

      await logBillingEvent(userId, eventType, item, plan, status, item.id)
      return new Response('ok')
    }

    // Unhandled event — log and return ok so Clerk doesn't retry
    console.log(`[webhook] Unhandled event type: ${eventType} — ignored`)
    return new Response('ok')

  } catch (err: any) {
    console.error('[webhook] Fatal error:', err?.message ?? err)
    return new Response('error', { status: 400 })
  }
}
