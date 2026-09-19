// app/platform/billing/BillingClient.tsx
'use client'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

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

// Status → design-system status classes (no hardcoded hex): everything in
// "good standing" reads as primary, at-risk as warning, gone as destructive.
function statusTextClass(status: string | null) {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'text-primary'
    case 'past_due':
      return 'text-warning'
    case 'canceled':
      return 'text-destructive'
    default:
      return 'text-muted-foreground'
  }
}

function statusBadgeVariant(status: string | null): 'default' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'default'
    case 'canceled':
      return 'destructive'
    default:
      return 'outline'
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
    <div className="flex max-w-2xl flex-col gap-4">

      {/* ── Current Plan ──────────────────────────────────────────────── */}
      <div className="text-xs tracking-wide text-muted-foreground">CURRENT PLAN</div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-1.5 flex items-center gap-2.5">
                <span className="text-xl font-bold text-foreground">{planLabel(subscription?.plan ?? null)}</span>
                {subscription?.status && <Badge variant={statusBadgeVariant(subscription.status)}>{subscription.status.toUpperCase()}</Badge>}
              </div>
              {subscription?.current_period_end && (
                <div className="text-sm text-muted-foreground">
                  {subscription.cancel_at_period_end ? `⚠ Cancels on ${formatDate(subscription.current_period_end)}` : `Renews ${formatDate(subscription.current_period_end)}`}
                </div>
              )}
              {subscription?.current_period_start && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Period: {formatDate(subscription.current_period_start)} → {formatDate(subscription.current_period_end)}
                </div>
              )}
              {isFree && <div className="mt-1 text-sm text-muted-foreground">You are on the free plan. Upgrade to unlock more features.</div>}
            </div>

            <Button asChild>
              <a href="/platform/billing/portal">{isFree ? 'Upgrade Plan' : 'Manage Plan'}</a>
            </Button>
          </div>

          {/* Plan feature bullets */}
          <div className="mt-4 flex flex-wrap gap-5 border-t pt-4">
            {[
              { label: 'Visitor Tracking', on: true },
              { label: 'Lead Intelligence', on: isPro || isElite },
              { label: 'Conversion Paths', on: isPro || isElite },
              { label: 'Intent Signals', on: isElite },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-1.5">
                <span className={`text-sm ${f.on ? 'text-primary' : 'text-muted-foreground'}`}>{f.on ? '✓' : '✗'}</span>
                <span className={`text-xs ${f.on ? 'text-foreground' : 'text-muted-foreground'}`}>{f.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Billing Email ─────────────────────────────────────────────── */}
      {profile?.email && (
        <>
          <div className="text-xs tracking-wide text-muted-foreground">BILLING EMAIL</div>
          <Card>
            <CardContent>
              <div className="text-sm text-foreground">{profile.email}</div>
              <div className="mt-1 text-xs text-muted-foreground">To update, change your email in your Clerk account settings.</div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Transaction History ───────────────────────────────────────── */}
      <div className="mt-2 text-xs tracking-wide text-muted-foreground">TRANSACTION HISTORY</div>

      {history.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">No billing events yet.</CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="grid grid-cols-[1fr_80px_80px_90px] gap-2 border-b px-4 py-2.5 text-xs tracking-wide text-muted-foreground">
            <span>EVENT</span>
            <span>PLAN</span>
            <span>AMOUNT</span>
            <span className="text-right">DATE</span>
          </div>

          {visibleHistory.map((evt, i) => (
            <div
              key={evt.id}
              className={`grid grid-cols-[1fr_80px_80px_90px] items-center gap-2 px-4 py-2.5 ${i < visibleHistory.length - 1 ? "border-b" : ""}`}
            >
              <div>
                <div className="text-sm text-foreground">{eventLabel(evt.event_type)}</div>
                {evt.status && <div className={`mt-0.5 text-xs ${statusTextClass(evt.status)}`}>{evt.status}</div>}
              </div>
              <div className="text-sm text-muted-foreground">{planLabel(evt.plan)}</div>
              <div className={`text-sm ${evt.amount_cents ? "text-primary" : "text-muted-foreground"}`}>{formatCents(evt.amount_cents, evt.currency ?? 'usd')}</div>
              <div className="text-right text-xs text-muted-foreground">{formatDate(evt.created_at)}</div>
            </div>
          ))}

          {hasMore && (
            <div className="border-t px-4 py-3">
              <Button variant="outline" size="sm" onClick={() => setHistoryLimit((l) => l + 20)}>
                Load more ({history.length - historyLimit} remaining)
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* ── Cancel notice ─────────────────────────────────────────────── */}
      {subscription?.cancel_at_period_end && subscription.current_period_end && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent>
            <div className="mb-1 text-sm font-bold text-destructive">Cancellation scheduled</div>
            <div className="text-xs text-muted-foreground">
              Your plan will remain active until {formatDate(subscription.current_period_end)}. After that, you will be moved to the free tier. To cancel this, click Manage Plan and reactivate.
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
