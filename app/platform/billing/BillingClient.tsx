// app/platform/billing/BillingClient.tsx
'use client'
import { useState } from 'react'

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatCents(cents: number | null, currency = 'usd') {
  if (cents == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function planLabel(plan: string | null) {
  if (!plan || plan === 'unknown') return 'Free'
  return plan.charAt(0).toUpperCase() + plan.slice(1)
}

function statusColor(status: string | null) {
  switch (status) {
    case 'active':    return '#4ade80'
    case 'trialing':  return '#60a5fa'
    case 'past_due':  return '#f59e0b'
    case 'canceled':  return '#f87171'
    default:          return '#666'
  }
}

function eventLabel(type: string) {
  const map: Record<string, string> = {
    'subscription.created':          'Subscription started',
    'subscription.updated':          'Subscription updated',
    'subscription.past_due':         'Payment past due',
    'subscription.canceled':         'Subscription canceled',
    'subscription.cancel_scheduled': 'Cancellation scheduled',
    'subscription.deleted':          'Subscription deleted',
  }
  return map[type] ?? type
}

// ─── props ────────────────────────────────────────────────────────────────────

interface Subscription {
  id: string
  plan: string
  status: string
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  cancelled_at: string | null
}

interface BillingEvent {
  id: string
  event_type: string
  plan: string | null
  status: string | null
  amount_cents: number | null
  currency: string | null
  period_start: string | null
  period_end: string | null
  created_at: string
}

interface Props {
  subscription: Subscription | null
  history: BillingEvent[]
  profile: { email: string | null; first_name: string | null; last_name: string | null } | null
  clerkUserId: string
}

// ─── component ───────────────────────────────────────────────────────────────

export default function BillingClient({ subscription, history, profile }: Props) {
  const [historyLimit, setHistoryLimit] = useState(10)

  const visibleHistory = history.slice(0, historyLimit)
  const hasMore = history.length > historyLimit

  const isPro   = subscription?.plan === 'pro'   && subscription.status === 'active'
  const isElite = subscription?.plan === 'elite' && subscription.status === 'active'
  const isFree  = !subscription || subscription.status === 'canceled' || subscription.plan === 'free'

  return (
    <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'monospace' }}>

      {/* ── Current Plan ──────────────────────────────────────────────── */}
      <div style={{ color: '#555', fontSize: 10, letterSpacing: 1 }}>CURRENT PLAN</div>

      <div style={{
        background: '#111', border: '1px solid #1a1a1a', borderRadius: 10,
        padding: '20px 20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ color: '#fff', fontSize: 22, fontWeight: 'bold' }}>
                {planLabel(subscription?.plan ?? null)}
              </span>
              {subscription?.status && (
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 'bold',
                  background: statusColor(subscription.status) + '20',
                  color: statusColor(subscription.status),
                  border: `1px solid ${statusColor(subscription.status)}40`,
                }}>
                  {subscription.status.toUpperCase()}
                </span>
              )}
            </div>
            {subscription?.current_period_end && (
              <div style={{ color: '#555', fontSize: 12 }}>
                {subscription.cancel_at_period_end
                  ? `⚠ Cancels on ${formatDate(subscription.current_period_end)}`
                  : `Renews ${formatDate(subscription.current_period_end)}`}
              </div>
            )}
            {subscription?.current_period_start && (
              <div style={{ color: '#333', fontSize: 11, marginTop: 4 }}>
                Period: {formatDate(subscription.current_period_start)} → {formatDate(subscription.current_period_end)}
              </div>
            )}
            {isFree && (
              <div style={{ color: '#555', fontSize: 12, marginTop: 4 }}>
                You are on the free plan. Upgrade to unlock more features.
              </div>
            )}
          </div>

          {/* Manage button — opens Clerk's billing portal */}
          <a
            href="/platform/billing/portal"
            style={{
              display: 'inline-block', padding: '8px 18px',
              background: '#4ade80', color: '#000',
              borderRadius: 6, fontSize: 12, fontWeight: 'bold',
              textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            {isFree ? 'Upgrade Plan' : 'Manage Plan'}
          </a>
        </div>

        {/* Plan feature bullets */}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #1a1a1a', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Visitor Tracking', on: true },
            { label: 'Lead Intelligence', on: isPro || isElite },
            { label: 'Conversion Paths', on: isPro || isElite },
            { label: 'Intent Signals',   on: isElite },
          ].map(f => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: f.on ? '#4ade80' : '#333', fontSize: 13 }}>
                {f.on ? '✓' : '✗'}
              </span>
              <span style={{ color: f.on ? '#aaa' : '#444', fontSize: 11 }}>{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Billing Email ─────────────────────────────────────────────── */}
      {profile?.email && (
        <>
          <div style={{ color: '#555', fontSize: 10, letterSpacing: 1 }}>BILLING EMAIL</div>
          <div style={{
            background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, padding: '12px 16px',
          }}>
            <div style={{ color: '#aaa', fontSize: 13 }}>{profile.email}</div>
            <div style={{ color: '#444', fontSize: 11, marginTop: 4 }}>
              To update, change your email in your Clerk account settings.
            </div>
          </div>
        </>
      )}

      {/* ── Transaction History ───────────────────────────────────────── */}
      <div style={{ color: '#555', fontSize: 10, letterSpacing: 1, marginTop: 8 }}>TRANSACTION HISTORY</div>

      {history.length === 0 ? (
        <div style={{
          background: '#111', border: '1px solid #1a1a1a', borderRadius: 8,
          padding: '24px 16px', color: '#444', fontSize: 12, textAlign: 'center',
        }}>
          No billing events yet.
        </div>
      ) : (
        <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px',
            padding: '10px 16px', borderBottom: '1px solid #1a1a1a',
            color: '#444', fontSize: 10, letterSpacing: 0.5,
          }}>
            <span>EVENT</span>
            <span>PLAN</span>
            <span>AMOUNT</span>
            <span style={{ textAlign: 'right' }}>DATE</span>
          </div>

          {visibleHistory.map((evt, i) => (
            <div key={evt.id} style={{
              display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px',
              padding: '10px 16px',
              borderBottom: i < visibleHistory.length - 1 ? '1px solid #0d0d0d' : 'none',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ color: '#ccc', fontSize: 12 }}>{eventLabel(evt.event_type)}</div>
                {evt.status && (
                  <div style={{ color: statusColor(evt.status), fontSize: 10, marginTop: 2 }}>
                    {evt.status}
                  </div>
                )}
              </div>
              <div style={{ color: '#888', fontSize: 12 }}>
                {planLabel(evt.plan)}
              </div>
              <div style={{ color: evt.amount_cents ? '#4ade80' : '#444', fontSize: 12 }}>
                {formatCents(evt.amount_cents, evt.currency ?? 'usd')}
              </div>
              <div style={{ color: '#555', fontSize: 11, textAlign: 'right' }}>
                {formatDate(evt.created_at)}
              </div>
            </div>
          ))}

          {hasMore && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid #1a1a1a' }}>
              <button
                onClick={() => setHistoryLimit(l => l + 20)}
                style={{
                  background: 'none', border: '1px solid #2a2a2a',
                  color: '#555', fontSize: 11, padding: '4px 12px',
                  borderRadius: 4, cursor: 'pointer',
                }}
              >
                Load more ({history.length - historyLimit} remaining)
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Cancel notice ─────────────────────────────────────────────── */}
      {subscription?.cancel_at_period_end && subscription.current_period_end && (
        <div style={{
          background: '#450a0a20', border: '1px solid #7f1d1d',
          borderRadius: 8, padding: '12px 16px',
        }}>
          <div style={{ color: '#f87171', fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>
            Cancellation scheduled
          </div>
          <div style={{ color: '#888', fontSize: 11 }}>
            Your plan will remain active until {formatDate(subscription.current_period_end)}.
            After that, you will be moved to the free tier.
            To cancel this, click Manage Plan and reactivate.
          </div>
        </div>
      )}

    </div>
  )
}