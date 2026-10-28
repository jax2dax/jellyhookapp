// app/platform/settings/PrivacyCards.jsx
// Settings, Privacy (2026-10-28): the cookie banner the tracker found on the site, how long data is kept, erasing one
// person on request, and where the data is stored. Server side: lib/actions/settings.actions.js (getPrivacyState,
// setRetention, erasePerson), lib/tracking/health.js (summarizeConsent), migration 35. Docs: /docs/concepts/privacy-consent.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { erasePerson, getPrivacyState, setRetention } from "@/lib/actions/settings.actions";
import { can } from "@/lib/tracking/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const RETENTION = [
  { value: 6, label: "6 months" },
  { value: 13, label: "13 months" },
  { value: 25, label: "25 months" },
  { value: null, label: "Keep everything" },
];

function Title({ children }) {
  return <div className="text-sm font-medium text-foreground">{children}</div>;
}

function Note({ children }) {
  return <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{children}</p>;
}

/** Which consent tool the tracker found, and what it does about it. */
export function CookieBannerCard({ consent }) {
  const c = consent || { state: "unknown" };
  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Title>Cookie banner</Title>
          {c.state === "found" && <Badge>Found: {c.tools.join(", ")}</Badge>}
          {c.state === "partial" && <Badge variant="outline">Found on some pages</Badge>}
          {c.state === "none" && <Badge variant="destructive">No banner found</Badge>}
          {c.state === "unknown" && <Badge variant="secondary">Not checked yet</Badge>}
        </div>
        {c.state === "found" && (
          <Note>
            The tracker follows {c.tools.join(", ")}: it starts only after a visitor accepts analytics or statistics, and stops and erases what it stored if they refuse or
            withdraw.
          </Note>
        )}
        {c.state === "partial" && (
          <Note>
            {c.tools.join(", ")} was found, but not on {c.pagesWithout.length} page{c.pagesWithout.length === 1 ? "" : "s"}: {c.pagesWithout.slice(0, 5).join(", ")}
            {c.pagesWithout.length > 5 ? "..." : ""}. On those pages the tracker runs without asking.
          </Note>
        )}
        {c.state === "none" && (
          <Note>
            The tracker runs without asking visitors. If your site has visitors from the EU or the UK, they need to accept first: add a cookie banner (Cookiebot, OneTrust,
            CookieYes, Complianz or any IAB TCF banner, or Google Consent Mode) and the tracker follows it with no code.
          </Note>
        )}
        {c.state === "unknown" && <Note>The tracker reports what it finds once it has seen a visit. Check back after your first visitors.</Note>}
        {c.mode === "manual" && <Note>Your script uses consent mode (data-require-consent): it waits for window.jellyhook.consent(true).</Note>}
        {c.mode === "ignore" && <Note>Your script has data-banner=&quot;ignore&quot;: it does not follow a banner.</Note>}
        <Link href="/docs/concepts/privacy-consent" className="text-xs text-primary underline-offset-2 hover:underline">
          How the tracker follows a banner
        </Link>
      </CardContent>
    </Card>
  );
}

/** Retention, erasure and storage location. */
export function PrivacyDataCards({ siteId, role }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [erased, setErased] = useState(null);

  useEffect(() => {
    getPrivacyState(siteId).then((r) => (r.success ? setState(r.data) : setError(r.error)));
  }, [siteId]);

  const canRetain = can(role, "privacy.retention");
  const canErase = can(role, "privacy.erase");

  async function choose(value) {
    setBusy(true);
    setError(null);
    const r = await setRetention(siteId, value);
    if (r.success) setState((s) => ({ ...s, retentionMonths: r.data.retentionMonths }));
    else setError(r.error);
    setBusy(false);
  }

  async function erase() {
    setBusy(true);
    setError(null);
    const r = await erasePerson(siteId, email);
    if (r.success) {
      setErased(r.data);
      setEmail("");
      setConfirming(false);
      const fresh = await getPrivacyState(siteId);
      if (fresh.success) setState(fresh.data);
    } else setError(r.error);
    setBusy(false);
  }

  if (!state && !error) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <>
      <Card>
        <CardContent className="space-y-3">
          <div>
            <Title>Data retention</Title>
            <Note>Visits, leads and form activity older than this are deleted every day. Choose the shortest period you need.</Note>
          </div>
          {state && (
            <div className="flex flex-wrap gap-2">
              {RETENTION.map((r) => (
                <Button key={String(r.value)} size="sm" variant={state.retentionMonths === r.value ? "default" : "outline"} disabled={busy || !canRetain} onClick={() => choose(r.value)}>
                  {r.label}
                </Button>
              ))}
            </div>
          )}
          {state?.purgedAt && <Note>Last cleaned {new Date(state.purgedAt).toLocaleString()}.</Note>}
          {!canRetain && <Note>Only an owner or admin can change this.</Note>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <div>
            <Title>Erase a person</Title>
            <Note>
              When someone asks you to delete their data, enter the email they used in your form. Every lead with that email is deleted, with the visits, page views, form
              activity and clicks of the browsers that sent them. This cannot be undone. Only a count and a one-way hash of the email are kept as a record.
            </Note>
          </div>
          {canErase ? (
            <>
              <div className="flex gap-2">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@example.com" className="flex-1" disabled={busy} />
                {!confirming ? (
                  <Button variant="destructive" disabled={busy || !email.trim()} onClick={() => setConfirming(true)}>
                    Erase
                  </Button>
                ) : (
                  <>
                    <Button variant="destructive" disabled={busy} onClick={erase}>
                      Erase for good
                    </Button>
                    <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
                      Cancel
                    </Button>
                  </>
                )}
              </div>
              {erased && (
                <Note>
                  Erased {erased.leads} lead{erased.leads === 1 ? "" : "s"} and {erased.visitors} visitor{erased.visitors === 1 ? "" : "s"} ({erased.rows} records).
                </Note>
              )}
            </>
          ) : (
            <Note>Only an owner or admin can erase a person.</Note>
          )}
          {state?.erasures?.length > 0 && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {state.erasures.map((e) => (
                <div key={e.created_at}>
                  {new Date(e.created_at).toLocaleDateString()}: {e.leads} lead{e.leads === 1 ? "" : "s"}, {e.visitors} visitor{e.visitors === 1 ? "" : "s"}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Title>Where the data is stored</Title>
          <Note>
            In the United States (Oregon). Jellyhook does not offer a data processing agreement yet, so it is not set up for sites that must have one, which is usually the
            case for sites with visitors from the EU or the UK.
          </Note>
        </CardContent>
      </Card>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </>
  );
}
