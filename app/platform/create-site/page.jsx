// app/platform/create-site/page.jsx
"use client";

import { useState, useEffect } from "react";
import { createSite, cancelVerification } from "@/lib/actions/site-management.actions";
import { useSearchParams } from "next/navigation";
import { getSiteVerificationStatus, renewClaim } from "@/lib/actions/site-management.actions";
import { addAllowedHost } from "@/lib/actions/settings.actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function CreateSitePage() {
  const searchParams = useSearchParams();

  // pending?status=pending&siteId=xxx&domain=xxx comes from verification gate redirect
  const statusParam = searchParams.get("status");
  const siteIdParam = searchParams.get("siteId");
  const domainParam = searchParams.get("domain");

  const [domain, setDomain] = useState("");
  const [specifyForm, setSpecifyForm] = useState(true); // recommended: label the form
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  // If redirected here with pending status, show pending UI immediately
  const showPendingFromParam = statusParam === "pending" && siteIdParam && domainParam;

  const handleSubmit = async () => {
    if (!domain.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await createSite({
        name: domain.trim(),
        domain: domain.trim(),
        specify_form: specifyForm,
      });
      if (res?.invalidDomain) {
        setError("Enter a domain like example.com, without a path.");
      } else {
        setResult(res);
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelVerification = async (siteId) => {
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await cancelVerification(siteId);
      if (res.success) {
        // Redirect to create-site fresh so they can start over or see empty state
        window.location.href = "/platform/create-site";
      } else {
        setCancelError(res.error);
      }
    } catch (err) {
      setCancelError(err.message || "Failed to cancel");
    } finally {
      setCancelling(false);
    }
  };

  // ── PENDING STATE (redirected from verification gate) ────────────────────
  if (showPendingFromParam) {
    return (
      <PageShell>
        <PendingUI domain={domainParam} siteId={siteIdParam} onCancel={handleCancelVerification} cancelling={cancelling} cancelError={cancelError} />
      </PageShell>
    );
  }

  // ── PLAN LIMIT REACHED ───────────────────────────────────────────────────
  if (result?.planLimitReached) {
    return (
      <PageShell>
        <Card className="w-full max-w-lg">
          <CardContent>
            <div className="mb-3 text-2xl text-warning">⚠</div>
            <h2 className="mb-3 text-xl font-bold text-foreground">Site Limit Reached</h2>
            <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
              Your current plan only allows <strong>1 site</strong>. Upgrade to <strong>Elite</strong> to manage multiple sites.
            </p>
            <div className="flex gap-2.5">
              <Button asChild>
                <a href="/platform/billing">Upgrade to Elite</a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/platform">Back to Dashboard</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  // ── DOMAIN ALREADY EXISTS (no access) ───────────────────────────────────
  if (result?.alreadyExists) {
    return (
      <PageShell>
        <Card className="w-full max-w-lg">
          <CardContent>
            <div className="mb-3 text-2xl text-warning">⚠</div>
            <h2 className="mb-3 text-xl font-bold text-foreground">Domain Already Registered</h2>
            <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
              <strong>{result.site.domain}</strong> is already registered. Your email doesn&apos;t match this domain. Ask the site owner to invite you from their Settings page.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setDomain("");
              }}
            >
              Try a different domain
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  // ── AUTO-JOINED VIA EMAIL DOMAIN MATCH ──────────────────────────────────
  if (result?.joined) {
    const script = `<script src="${process.env.NEXT_PUBLIC_TRACKER_URL || "http://localhost:3000"}/tracker.js" data-key="${result.site.api_key}"></script>`;
    return (
      <PageShell>
        <Card className="w-full max-w-lg">
          <CardContent>
            <div className="mb-3 text-2xl text-primary">✅</div>
            <h2 className="mb-3 text-xl font-bold text-foreground">Joined Existing Site</h2>
            <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
              Your email matched <strong>{result.site.domain}</strong>, so you&apos;ve been added automatically. The tracker is already installed.
            </p>
            <ScriptBlock script={script} />
            <Button asChild>
              <a href="/platform">Go to Dashboard →</a>
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  // ── ALREADY A MEMBER ─────────────────────────────────────────────────────
  if (result?.alreadyMember) {
    const script = result.site?.api_key ? `<script src="${process.env.NEXT_PUBLIC_TRACKER_URL || "http://localhost:3000"}/tracker.js" data-key="${result.site.api_key}"></script>` : null;
    return (
      <PageShell>
        <Card className="w-full max-w-lg">
          <CardContent>
            <div className="mb-3 text-2xl text-muted-foreground">ℹ</div>
            <h2 className="mb-3 text-xl font-bold text-foreground">You Already Have Access</h2>
            <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
              You already have access to <strong>{result.site.domain}</strong>.
            </p>
            {script && <ScriptBlock script={script} />}
            <Button asChild>
              <a href="/platform">Go to Dashboard →</a>
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  // ── RECLAIMED (unverified, original owner) ───────────────────────────────
  if (result?.reclaimed) {
    const script = `<script src="${process.env.NEXT_PUBLIC_TRACKER_URL || "http://localhost:3000"}/tracker.js" data-key="${result.site.api_key}"></script>`;
    return (
      <PageShell>
        <Card className="w-full max-w-lg">
          <CardContent>
            <div className="mb-3 text-2xl text-primary">✅</div>
            <h2 className="mb-3 text-xl font-bold text-foreground">Site Reclaimed</h2>
            <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
              You previously registered <strong>{result.site.domain}</strong> but never installed the script. Your API key is unchanged.
              {result.renewed && " Your earlier setup had expired, so it has been renewed for 3 more days."}
            </p>
            <p className="mb-2 block text-xs text-muted-foreground">
              Paste inside the <code className="rounded bg-muted px-1.5 py-0.5 text-xs">&lt;head&gt;</code> of your site:
            </p>
            <ScriptBlock script={script} />
            {result.site.specify_form && (
              <>
                <p className="mb-2 block text-xs text-muted-foreground">Add to your conversion form:</p>
                <ScriptBlock script={`<form data-conversion="true">\n  ...\n</form>`} />
              </>
            )}
            <Button asChild>
              <a href="/platform">Go to Dashboard →</a>
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  // ── NEW SITE CREATED — show pending verification UI ──────────────────────
  if (result?.site && !result.joined) {
    return (
      <PageShell>
        <PendingUI
          domain={result.site.domain}
          siteId={result.site.id}
          apiKey={result.site.api_key}
          competing={result.competing || 0}
          specifyForm={specifyForm}
          onCancel={handleCancelVerification}
          cancelling={cancelling}
          cancelError={cancelError}
        />
      </PageShell>
    );
  }

  // ── DEFAULT: Registration form ───────────────────────────────────────────
  return (
    <PageShell>
      <Card className="w-full max-w-lg">
        <CardContent>
          <h1 className="text-xl font-bold text-foreground">Add your site</h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">Two small steps and you are tracking. No SDK, nothing to configure.</p>

          <div className="mb-6">
            <label className="mb-2 block text-xs text-muted-foreground">Your domain</label>
            <Input placeholder="yourdomain.com" value={domain} onChange={(e) => setDomain(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit()} autoFocus />
            <p className="mt-1 text-xs text-muted-foreground">Without https:// or www</p>
          </div>

          <div className="mb-6">
            <div className="mb-2 text-xs text-muted-foreground">Which forms count as leads?</div>
            <div role="radiogroup" className="flex flex-col gap-2">
              <ChoiceCard
                selected={specifyForm}
                onSelect={() => setSpecifyForm(true)}
                title="Only the form I label"
                badge="Recommended"
                description="Add one attribute to your contact or demo form. Newsletter and search boxes are never mistaken for leads."
              />
              <ChoiceCard
                selected={!specifyForm}
                onSelect={() => setSpecifyForm(false)}
                title="Every form on my site"
                description="Nothing to label. Any form with an email counts, newsletter boxes included."
              />
            </div>
          </div>

          <div className="mb-6 rounded-lg border bg-muted/30 p-4">
            <div className="mb-3 text-xs font-medium text-foreground">How it works</div>
            <ol className="space-y-3 text-xs text-muted-foreground">
              <li className="flex gap-3">
                <StepDot n={1} />
                <span>
                  Paste one line inside the <code className="rounded bg-muted px-1 py-0.5">&lt;head&gt;</code> of your site.
                </span>
              </li>
              {specifyForm && (
                <li className="flex gap-3">
                  <StepDot n={2} />
                  <span>
                    Add <code className="rounded bg-muted px-1 py-0.5">data-conversion=&quot;true&quot;</code> to the form you want tracked. Every field of that form is tracked by default (recommended).
                    To track only some fields, add <code className="rounded bg-muted px-1 py-0.5">data-track-field</code> to those inputs.
                  </span>
                </li>
              )}
              <li className="flex gap-3">
                <StepDot n={specifyForm ? 3 : 2} />
                <span>That is it. We notice the first visit by ourselves and open your dashboard.</span>
              </li>
            </ol>
          </div>

          {error && <p className="mb-3 text-xs text-destructive">{error}</p>}

          <Button onClick={handleSubmit} disabled={loading || !domain.trim()} className="w-full">
            {loading ? "Checking..." : "Get my script"}
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}

function ChoiceCard({ selected, onSelect, title, badge, description }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${selected ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
    >
      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? "border-primary" : "border-muted-foreground/50"}`}>
        {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          {title}
          {badge && <Badge variant="outline" className="border-primary/40 text-primary">{badge}</Badge>}
        </span>
        <span className="text-xs leading-relaxed text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

function StepDot({ n }) {
  return <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">{n}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// PendingUI — shown after site creation OR when redirected from gated pages
// Shows script to install, pending badge, and cancel button
// ─────────────────────────────────────────────────────────────────────────────
function PendingUI({ domain, siteId, apiKey, competing = 0, specifyForm, onCancel, cancelling, cancelError }) {
  const trackerBase = process.env.NEXT_PUBLIC_TRACKER_URL || "http://localhost:3000";
  const [status, setStatus] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!siteId) return;
    let stopped = false;
    const check = async () => {
      const st = await getSiteVerificationStatus(siteId);
      if (stopped || !st) return;
      setStatus(st);
      if (st.verified) {
        stopped = true;
        window.location.href = "/platform/dashboard";
      }
    };
    check();
    const interval = setInterval(check, 3000); // check every 3 seconds
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [siteId]);

  async function handleRenew() {
    setBusy(true);
    setActionError(null);
    const res = await renewClaim(siteId);
    if (!res.success) setActionError(res.error);
    else setStatus((st) => (st ? { ...st, expired: false, expiresAt: new Date(Date.now() + 3 * 86400000).toISOString() } : st));
    setBusy(false);
  }

  async function handleAllow(host) {
    setBusy(true);
    setActionError(null);
    const res = await addAllowedHost(siteId, host);
    if (!res.success) setActionError(res.error);
    else setStatus((st) => (st ? { ...st, unmatchedHost: null } : st));
    setBusy(false);
  }

  const script = apiKey ? `<script src="${trackerBase}/tracker.js" data-key="${apiKey}"></script>` : null;

  return (
    <Card className="w-full max-w-lg">
      <CardContent>
        <div className="mb-5 flex items-center gap-2.5">
          <Badge variant="outline" className="border-warning/40 text-warning">
            ● PENDING VERIFICATION
          </Badge>
        </div>

        <h2 className="mb-3 text-xl font-bold text-foreground">{domain}</h2>
        <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
          Waiting for the first tracker hit from your site. Once the script loads on your site, your dashboard will activate automatically.
        </p>

        {/* Animated waiting indicator */}
        <div className="mb-1 rounded-lg border bg-muted/30 p-4 text-center">
          <div className="mb-2 text-xs text-muted-foreground">Listening for connection...</div>
          <div className="flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>

        {competing > 0 && (
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            {competing === 1 ? "Someone else is" : `${competing} other people are`} also setting up <strong>{domain}</strong>. Whoever installs the script on the real website first is verified and owns it.
          </p>
        )}

        {status?.unmatchedHost && (
          <div className="mt-4 rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs leading-relaxed text-muted-foreground">
            We received data from <strong className="text-foreground">{status.unmatchedHost}</strong>, but this site is set up for <strong className="text-foreground">{domain}</strong>, so it was not recorded.
            If {status.unmatchedHost} is a test or staging copy of your site, you can allow it. If you pasted the script on the wrong website, move it to {domain}.
            <div className="mt-2">
              <Button size="xs" variant="outline" disabled={busy} onClick={() => handleAllow(status.unmatchedHost)}>
                Allow {status.unmatchedHost}
              </Button>
            </div>
          </div>
        )}

        {status?.expired ? (
          <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs leading-relaxed text-muted-foreground">
            This setup expired because the script was not installed within 3 days. Nothing is recorded until you renew it.
            <div className="mt-2">
              <Button size="xs" disabled={busy} onClick={handleRenew}>
                Renew for 3 more days
              </Button>
            </div>
          </div>
        ) : (
          status && <p className="mt-4 text-xs text-muted-foreground">Install the script before {new Date(status.expiresAt).toLocaleString()}. After that, this setup expires and you can start again.</p>
        )}
        {actionError && <p className="mt-2 text-xs text-destructive">{actionError}</p>}

        {/* Script install instructions */}
        {script && (
          <div className="mt-5">
            <p className="mb-2 block text-xs text-muted-foreground">
              1. Paste inside the <code className="rounded bg-muted px-1.5 py-0.5 text-xs">&lt;head&gt;</code> of your site:
            </p>
            <ScriptBlock script={script} />
          </div>
        )}

        {specifyForm && (
          <div className="mt-4">
            <p className="mb-2 block text-xs text-muted-foreground">2. Add this to the form you want tracked. All its fields are tracked by default:</p>
            <ScriptBlock script={`<form data-conversion="true">\n  ...\n</form>`} />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Optional: to track only some fields, add <code className="rounded bg-muted px-1.5 py-0.5">data-track-field</code> to those inputs.
            </p>
          </div>
        )}

        {/* Cancel option */}
        <div className="mt-6 border-t pt-5">
          <p className="mb-3 text-xs text-muted-foreground">Registered the wrong domain? You can cancel and start over.</p>
          {cancelError && <p className="mb-2 text-xs text-destructive">{cancelError}</p>}
          <Button variant="destructive" onClick={() => onCancel(siteId)} disabled={cancelling}>
            {cancelling ? "Cancelling..." : "Cancel & Start Over"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ScriptBlock({ script }) {
  return <pre className="mb-4 overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap break-all text-sky-400">{script}</pre>;
}

function PageShell({ children }) {
  return <div className="flex min-h-screen items-center justify-center bg-background p-6">{children}</div>;
}
