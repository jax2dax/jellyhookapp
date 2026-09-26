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
// Field names below were re-derived from an ACTUAL captured payload, not just
// the docs — a subscription.updated event for a real test account. The
// previous version had three separate bugs, all silently producing nulls or
// the wrong plan on every event:
//   1. Reading `data.current_period_start`/`current_period_end` — the real
//      field names are `period_start`/`period_end`, and they only exist on
//      an ITEM, never on the subscription container itself.
//   2. Passing those (nonexistent) values through `toIso()` as if they were
//      unix SECONDS (`* 1000`) — Clerk's timestamps are already unix
//      MILLISECONDS, so even a correctly-named field would have come out
//      multiplied by 1000 again and landed decades in the future.
//   3. `getPlanSlug` on a subscription-level event just took `items[0]`
//      unconditionally. A Clerk commerce_subscription can hold several items
//      at once in different lifecycle states as a user changes plans over
//      time (upcoming / active / canceled / abandoned / ended) — items[0]
//      is whatever Clerk happens to return first, not necessarily anything
//      currently in effect. See pickCurrentDisplayItem below.
// ─────────────────────────────────────────────────────────────────────────────

function getUserId(data: any): string | null {
  return data?.payer?.user_id ?? data?.user_id ?? data?.userId ?? null
}

// Clerk's timestamps on subscriptions/items (created_at, updated_at,
// period_start, period_end, canceled_at, ...) are already unix milliseconds —
// do not multiply by 1000.
function toIso(unixMs: number | null | undefined): string | null {
  return unixMs ? new Date(unixMs).toISOString() : null
}

const PLAN_RANK: Record<string, number> = { elite: 2, pro: 1, basic: 0, free_user: 0, free: 0 }

// Picks whichever item in a subscription's `items[]` should currently be
// treated as "the plan" for display/access purposes:
//   - "upcoming" items haven't started yet — excluded.
//   - "abandoned" items were never actually paid for — excluded.
//   - "active" or "canceled" items whose period_end is still in the future
//     (or has no period_end at all) are still in effect RIGHT NOW — a
//     canceled item means "won't renew," not "access already revoked."
//     This is what makes "downgraded from elite to free, but still elite
//     until the period ends" work: the elite item stays picked here until
//     its period_end genuinely passes, even though its status flipped to
//     canceled the moment the downgrade was requested.
//   - If more than one item still qualifies, the highest-tier one wins.
function pickCurrentDisplayItem(items: any[] | undefined): any | null {
  const now = Date.now()
  const inWindow = (items || []).filter((it) => {
    if (!it || it.status === 'upcoming' || it.status === 'abandoned') return false
    if (it.period_end && it.period_end < now) return false
    return it.status === 'active' || it.status === 'canceled'
  })
  if (inWindow.length === 0) return null
  return inWindow.sort((a, b) => (PLAN_RANK[b?.plan?.slug] ?? 0) - (PLAN_RANK[a?.plan?.slug] ?? 0))[0]
}

// Upserts the ONE current-plan row for a user. Deliberately keyed by
// user_id (read-then-write) instead of `ON CONFLICT (id)` — Clerk's
// subscription id and subscriptionItem id are different values for the same
// user, so conflicting on `id` would leave multiple rows per user and
// getCurrentSubscription()'s single-row read would only ever see whichever
// happened to be inserted, unpredictably.
//
// Only called from subscription-level events (see below) — never from lone
// subscriptionItem events, which only ever see ONE item and have no way to
// know whether some OTHER item is the one that should actually be displayed
// right now. Computing the effective plan needs the full items[] list.
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
    .select('id, plan, plan_started_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (findError) {
    console.error('[webhook] subscriptions lookup error:', findError.message)
  }

  const now = new Date().toISOString()
  // plan_started_at tracks "since when has this user been on THIS plan" —
  // only bumped when the plan actually changes, left alone on same-plan
  // updates (renewals, status refreshes) so it doesn't reset every event.
  const planChanged = !existing || existing.plan !== fields.plan
  const payload = {
    user_id: userId,
    ...fields,
    updated_at: now,
    ...(planChanged ? { plan_started_at: now } : {}),
  }

  if (existing) {
    return supabase.from('subscriptions').update(payload).eq('id', existing.id)
  }
  return supabase.from('subscriptions').insert({ id: sourceId, plan_started_at: now, ...payload })
}

async function logBillingEvent(
  userId: string,
  eventType: string,
  plan: string,
  status: string,
  subId: string,
  amountCents: number | null,
  currency: string | null,
  periodStart: string | null,
  periodEnd: string | null,
  rawPayload: any,
) {
  const { error } = await supabase.from('billing_events').insert({
    user_id: userId,
    event_type: eventType,
    plan,
    status,
    amount_cents: amountCents,
    currency: currency ?? 'usd',
    subscription_id: subId,
    period_start: periodStart,
    period_end: periodEnd,
    raw_payload: rawPayload,
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
    //
    // pfp is only ever set when has_image is true. Clerk's image_url is
    // NEVER empty — it returns an auto-generated default avatar even when
    // nobody has uploaded a real photo — so storing it unconditionally would
    // make pfp useless as a "did they actually upload something" signal. The
    // app (see components/nav-user.tsx, app/platform/user/UserPageClient.tsx)
    // relies on pfp being null to mean exactly that: show the default icon.
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
        pfp: user.has_image ? user.image_url ?? null : null,
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
    // Keeps pfp in sync with Clerk's uploaded photo on every event — but
    // ONLY when has_image is true (see the has_image note on user.created
    // above). When someone removes their photo in Clerk, has_image goes
    // back to false and this correctly clears pfp back to null too, rather
    // than freezing on their last real photo forever.
    //
    // Deliberately does NOT touch first_name/last_name, and does NOT
    // overwrite email once it's already set — once someone has customized
    // either from /platform/user (see lib/actions/profile.actions.js
    // updateMyProfile), a Clerk-side profile edit (e.g. changing their
    // avatar, which fires this same event) must never clobber it. Email is
    // only ever seeded from Clerk the FIRST time — a still-null email means
    // this is effectively the first sync (e.g. a row created before this
    // webhook existed, or the user.created insert somehow left it blank).
    // ─────────────────────────────────────────────────────────────────────
    if (eventType === 'user.updated') {
      const user = evt.data as any
      const primaryEmail =
        user.email_addresses?.find((e: any) => e.id === user.primary_email_address_id)?.email_address ??
        user.email_addresses?.[0]?.email_address ??
        null

      const { data: existing } = await supabase.from('users').select('email').eq('id', user.id).maybeSingle()

      const payload: { id: string; pfp: string | null; email?: string | null } = {
        id: user.id,
        pfp: user.has_image ? user.image_url ?? null : null,
      }
      if (!existing?.email) payload.email = primaryEmail

      // upsert (not update) — covers a user.updated arriving for someone who
      // signed up before this webhook was wired up and has no row yet.
      const { error } = await supabase.from('users').upsert(payload, { onConflict: 'id' })

      if (error) {
        console.error('[webhook] user.updated — DB update error:', error.message)
        return new Response('db_error', { status: 500 })
      }

      console.log(`[webhook] ✅ user.updated — synced userId=${user.id}`)
      return new Response('ok')
    }

    // ─────────────────────────────────────────────────────────────────────
    // SUBSCRIPTION-LEVEL EVENTS — created / updated / active / pastDue
    // Fires on the top-level Subscription container, which carries the FULL
    // items[] list — the only place we can correctly compute which item is
    // actually in effect right now (see pickCurrentDisplayItem). This is the
    // sole writer of the `subscriptions` mirror row; subscriptionItem.*
    // events below only log to billing_events, never write here (a lone
    // item has no visibility into its siblings, so it can't safely decide
    // what the "current" plan should be — see that block for why).
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

      const displayItem = pickCurrentDisplayItem(sub.items)
      const plan = displayItem?.plan?.slug ?? 'free'
      const status = displayItem?.status ?? (eventType === 'subscription.pastDue' ? 'past_due' : sub.status ?? 'active')
      const periodStart = toIso(displayItem?.period_start)
      const periodEnd = toIso(displayItem?.period_end)
      const cancelAtPeriodEnd = displayItem?.status === 'canceled'
      const cancelledAt = cancelAtPeriodEnd ? toIso(sub.canceled_at) ?? new Date().toISOString() : null

      const { error: subError } = await upsertUserSubscription(
        userId,
        {
          plan,
          status,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          cancel_at_period_end: cancelAtPeriodEnd,
          cancelled_at: cancelledAt,
        },
        sub.id,
      )

      if (subError) {
        console.error(`[webhook] ${eventType} — subscriptions upsert error:`, subError.message)
      } else {
        console.log(`[webhook] ✅ ${eventType} — synced userId=${userId} plan=${plan} status=${status}${cancelAtPeriodEnd ? ` (cancels ${periodEnd})` : ''}`)
      }

      let billingEventType: string = eventType
      if (status === 'past_due') billingEventType = 'subscription.past_due'
      if (cancelAtPeriodEnd) billingEventType = 'subscription.cancel_scheduled'

      await logBillingEvent(
        userId,
        billingEventType,
        plan,
        status,
        sub.id,
        displayItem?.plan?.amount ?? null,
        displayItem?.plan?.currency ?? null,
        periodStart,
        periodEnd,
        sub,
      )
      return new Response('ok')
    }

    // ─────────────────────────────────────────────────────────────────────
    // SUBSCRIPTION-ITEM EVENTS — active / updated / canceled / pastDue
    // Clerk Billing has no `subscription.canceled` — cancellation is an
    // item-level event. Items carry their own `plan.slug`/`period_start`/
    // `period_end`/`plan.amount`/`plan.currency` directly.
    //
    // These are audit-log only (billing_events) — they do NOT write to the
    // `subscriptions` display row. A lone item has no idea whether some
    // OTHER item (e.g. an elite plan still inside its paid period) should
    // still be the one shown as "current." Writing here unconditionally was
    // exactly what caused "downgrade to free instantly marks elite
    // canceled" — whichever item's event happened to arrive/process last
    // won, regardless of which one was actually still in effect. The
    // subscription.* handler above always re-derives the correct display
    // row from the complete items[] list, and Clerk fires a subscription.*
    // event alongside every item change, so nothing is lost — just decided
    // by the handler that can actually see the whole picture.
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

      const plan = item?.plan?.slug ?? 'unknown'
      const status = eventType === 'subscriptionItem.canceled' ? 'canceled' : eventType === 'subscriptionItem.pastDue' ? 'past_due' : item.status ?? 'active'

      await logBillingEvent(
        userId,
        eventType,
        plan,
        status,
        item.id,
        item?.plan?.amount ?? null,
        item?.plan?.currency ?? null,
        toIso(item.period_start),
        toIso(item.period_end),
        item,
      )
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
