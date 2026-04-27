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

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req)
    const eventType = evt.type
    console.log(`[webhook] Received event: ${eventType}`)

    // ─────────────────────────────────────────────────────────────────────
    // USER CREATED — unchanged from your original
    // ─────────────────────────────────────────────────────────────────────
    if (eventType === 'user.created') {
      const user = evt.data as any

      const { error } = await supabase.from('users').insert({
        id: user.id,
        email: user.email_addresses?.[0]?.email_address ?? null,
      })

      if (error) {
        console.error('[webhook] user.created — DB insert error:', error.message)
        return new Response('db_error', { status: 500 })
      }

      console.log(`[webhook] ✅ user.created — inserted userId=${user.id}`)
      return new Response('ok')
    }

    // ─────────────────────────────────────────────────────────────────────
    // SUBSCRIPTION CREATED
    // Fires when a user subscribes to a plan for the first time
    // ─────────────────────────────────────────────────────────────────────
    if (eventType === 'subscription.created') {
      const sub = evt.data as any
      console.log(`[webhook] subscription.created raw:`, JSON.stringify(sub, null, 2))

      const userId    = sub.user_id ?? sub.userId ?? null
      const subId     = sub.id
      const plan      = sub.plan_id ?? sub.plan ?? sub.plan_slug ?? 'unknown'
      const status    = sub.status ?? 'active'
      const periodStart = sub.current_period_start
        ? new Date(sub.current_period_start * 1000).toISOString()
        : null
      const periodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null

      if (!userId) {
        console.error('[webhook] subscription.created — missing user_id in payload')
        return new Response('missing_user_id', { status: 400 })
      }

      // Upsert subscription row
      const { error: subError } = await supabase.from('subscriptions').upsert({
        id: subId,
        user_id: userId,
        plan,
        status,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
        cancelled_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

      if (subError) {
        console.error('[webhook] subscription.created — subscriptions upsert error:', subError.message)
      } else {
        console.log(`[webhook] ✅ subscription.created — upserted subId=${subId} userId=${userId} plan=${plan} status=${status}`)
      }

      // Insert billing event for full history
      const { error: evtError } = await supabase.from('billing_events').insert({
        user_id: userId,
        event_type: 'subscription.created',
        plan,
        status,
        amount_cents: sub.amount_cents ?? null,
        currency: sub.currency ?? 'usd',
        subscription_id: subId,
        period_start: periodStart,
        period_end: periodEnd,
        raw_payload: sub,
      })

      if (evtError) {
        console.error('[webhook] subscription.created — billing_events insert error:', evtError.message)
      } else {
        console.log(`[webhook] ✅ subscription.created — billing_event logged for userId=${userId}`)
      }

      return new Response('ok')
    }

    // ─────────────────────────────────────────────────────────────────────
    // SUBSCRIPTION UPDATED
    // Fires on: plan change, status change (active→past_due, etc.),
    // renewal (period rollover), cancel toggle, reactivation
    // ─────────────────────────────────────────────────────────────────────
    if (eventType === 'subscription.updated') {
      const sub = evt.data as any
      console.log(`[webhook] subscription.updated raw:`, JSON.stringify(sub, null, 2))

      const userId    = sub.user_id ?? sub.userId ?? null
      const subId     = sub.id
      const plan      = sub.plan_id ?? sub.plan ?? sub.plan_slug ?? 'unknown'
      const status    = sub.status ?? 'active'
      const periodStart = sub.current_period_start
        ? new Date(sub.current_period_start * 1000).toISOString()
        : null
      const periodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null
      const cancelAtPeriodEnd = sub.cancel_at_period_end ?? false

      // Determine if this is a cancellation toggle
      const cancelledAt = (status === 'canceled' || cancelAtPeriodEnd)
        ? (sub.cancelled_at ? new Date(sub.cancelled_at * 1000).toISOString() : new Date().toISOString())
        : null

      if (!userId) {
        console.error('[webhook] subscription.updated — missing user_id in payload')
        return new Response('missing_user_id', { status: 400 })
      }

      const { error: subError } = await supabase.from('subscriptions').upsert({
        id: subId,
        user_id: userId,
        plan,
        status,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
        cancelled_at: cancelledAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

      if (subError) {
        console.error('[webhook] subscription.updated — subscriptions upsert error:', subError.message)
      } else {
        console.log(`[webhook] ✅ subscription.updated — upserted subId=${subId} userId=${userId} plan=${plan} status=${status} cancelAtEnd=${cancelAtPeriodEnd}`)
      }

      // Determine a human-readable event type for billing history
      let billingEventType = 'subscription.updated'
      if (status === 'past_due')  billingEventType = 'subscription.past_due'
      if (status === 'canceled')  billingEventType = 'subscription.canceled'
      if (cancelAtPeriodEnd)      billingEventType = 'subscription.cancel_scheduled'

      const { error: evtError } = await supabase.from('billing_events').insert({
        user_id: userId,
        event_type: billingEventType,
        plan,
        status,
        amount_cents: sub.amount_cents ?? null,
        currency: sub.currency ?? 'usd',
        subscription_id: subId,
        period_start: periodStart,
        period_end: periodEnd,
        raw_payload: sub,
      })

      if (evtError) {
        console.error('[webhook] subscription.updated — billing_events insert error:', evtError.message)
      } else {
        console.log(`[webhook] ✅ subscription.updated — billing_event '${billingEventType}' logged for userId=${userId}`)
      }

      return new Response('ok')
    }

    // ─────────────────────────────────────────────────────────────────────
    // SUBSCRIPTION DELETED
    // Fires when the subscription is fully removed (not just cancelled)
    // ─────────────────────────────────────────────────────────────────────
    // if (eventType === 'subscription.deleted') {
    //   const sub = evt.data as any
    //   console.log(`[webhook] subscription.deleted raw:`, JSON.stringify(sub, null, 2))

    //   const userId = sub.user_id ?? sub.userId ?? null
    //   const subId  = sub.id

    //   if (!userId) {
    //     console.error('[webhook] subscription.deleted — missing user_id in payload')
    //     return new Response('missing_user_id', { status: 400 })
    //   }

    //   const { error: subError } = await supabase.from('subscriptions').upsert({
    //     id: subId,
    //     user_id: userId,
    //     plan: sub.plan_id ?? sub.plan ?? 'unknown',
    //     status: 'canceled',
    //     cancel_at_period_end: false,
    //     cancelled_at: new Date().toISOString(),
    //     updated_at: new Date().toISOString(),
    //   }, { onConflict: 'id' })

    //   if (subError) {
    //     console.error('[webhook] subscription.deleted — subscriptions upsert error:', subError.message)
    //   } else {
    //     console.log(`[webhook] ✅ subscription.deleted — marked canceled subId=${subId} userId=${userId}`)
    //   }

    //   const { error: evtError } = await supabase.from('billing_events').insert({
    //     user_id: userId,
    //     event_type: 'subscription.deleted',
    //     plan: sub.plan_id ?? sub.plan ?? 'unknown',
    //     status: 'canceled',
    //     subscription_id: subId,
    //     raw_payload: sub,
    //   })

    //   if (evtError) {
    //     console.error('[webhook] subscription.deleted — billing_events insert error:', evtError.message)
    //   } else {
    //     console.log(`[webhook] ✅ subscription.deleted — billing_event logged for userId=${userId}`)
    //   }

    //   return new Response('ok')
    // }

    //end

    // Unhandled event — log and return ok so Clerk doesn't retry
    console.log(`[webhook] Unhandled event type: ${eventType} — ignored`)
    return new Response('ok')

  } catch (err: any) {
    console.error('[webhook] Fatal error:', err?.message ?? err)
    return new Response('error', { status: 400 })
  }
}


/*import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
    
  try {
    const evt = await verifyWebhook(req)

    if (evt.type === 'user.created') {
      const user = evt.data

      await supabase.from('users').insert({
        id: user.id,
        email: user.email_addresses[0]?.email_address,
      })
      console.log('Webhook event payload:', evt)
    }

    return new Response('ok')
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response('error', { status: 400 })
  }
}*///working version