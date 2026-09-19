// app/platform/create-site/page.jsx
"use client";

import { useState, useEffect } from "react";
import { createSite, cancelVerification } from "@/lib/actions/site-management.actions";
import { useSearchParams } from "next/navigation";
import { getSiteVerifiedStatus } from "@/lib/actions/site-management.actions";
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
  const [specifyForm, setSpecifyForm] = useState(false);
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
      setResult(res);
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
              Your email matched <strong>{result.site.domain}</strong> — you&apos;ve been added automatically. The tracker is already installed.
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
            </p>
            <p className="mb-2 block text-xs text-muted-foreground">
              Paste before your closing <code className="rounded bg-muted px-1.5 py-0.5 text-xs">&lt;/body&gt;</code>:
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
          <h1 className="mb-5 text-xl font-bold text-foreground">Add Your Site</h1>

          <div className="mb-5">
            <label className="mb-2 block text-xs text-muted-foreground">Your domain</label>
            <Input placeholder="yourdomain.com" value={domain} onChange={(e) => setDomain(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
            <p className="mt-1 text-xs text-muted-foreground">Without https:// or www</p>
          </div>

          <div className="mb-5 rounded-lg border bg-muted/30 p-4">
            <p className="mb-1 text-xs text-muted-foreground">Do you have a specific conversion form?</p>
            <p className="mb-3 text-xs text-muted-foreground">A contact form, demo request, or sign-up — not a search bar or newsletter.</p>
            <div className="flex gap-2.5">
              <Button size="sm" variant={!specifyForm ? "default" : "outline"} onClick={() => setSpecifyForm(false)}>
                No — track all forms
              </Button>
              <Button size="sm" variant={specifyForm ? "default" : "outline"} onClick={() => setSpecifyForm(true)}>
                Yes — I&apos;ll label my form
              </Button>
            </div>
          </div>

          {error && <p className="mb-3 text-xs text-destructive">{error}</p>}

          <Button onClick={handleSubmit} disabled={loading || !domain.trim()}>
            {loading ? "Checking..." : "Continue"}
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PendingUI — shown after site creation OR when redirected from gated pages
// Shows script to install, pending badge, and cancel button
// ─────────────────────────────────────────────────────────────────────────────
function PendingUI({ domain, siteId, apiKey, specifyForm, onCancel, cancelling, cancelError }) {
  const trackerBase = process.env.NEXT_PUBLIC_TRACKER_URL || "http://localhost:3000";
  useEffect(() => {
    if (!siteId) return;
    const interval = setInterval(async () => {
      const verified = await getSiteVerifiedStatus(siteId);
      if (verified) {
        clearInterval(interval);
        window.location.href = "/platform/dashboard";
      }
    }, 3000); // check every 3 seconds
    return () => clearInterval(interval);
  }, [siteId]);
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

        {/* Script install instructions */}
        {script && (
          <div className="mt-5">
            <p className="mb-2 block text-xs text-muted-foreground">
              Step 1 — Paste before your closing <code className="rounded bg-muted px-1.5 py-0.5 text-xs">&lt;/body&gt;</code> tag:
            </p>
            <ScriptBlock script={script} />
          </div>
        )}

        {specifyForm && (
          <div className="mt-4">
            <p className="mb-2 block text-xs text-muted-foreground">Step 2 — Add to your conversion form:</p>
            <ScriptBlock script={`<form data-conversion="true">\n  ...\n</form>`} />
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
  return <pre className="mb-4 overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap break-all text-primary">{script}</pre>;
}

function PageShell({ children }) {
  return <div className="flex min-h-screen items-center justify-center bg-background p-6">{children}</div>;
}
