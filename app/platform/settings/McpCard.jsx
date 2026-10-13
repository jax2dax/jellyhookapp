// app/platform/settings/McpCard.jsx
// AI access tokens (MCP): let an AI app such as Claude or Cursor read THIS site's Hook data. Owner and admin only.
// Creating a token needs a consent tick (and a second one for personal details); the token is shown once.
// Rules: mds/build/mcp/plan.md. Shown only when MCP_ENABLED=1 on the server (see settings/page.jsx).
"use client";

import { useEffect, useState } from "react";
import { createMcpToken, listMcpTokens, revokeMcpToken } from "@/lib/actions/mcpTokens.action";
import { CONSENT_TEXT, PII_CONSENT_TEXT } from "@/jh-mcp/consent";
import { DEFAULT_EXPIRY_DAYS, EXPIRY_DAYS } from "@/jh-mcp/tokens";
import { can } from "@/lib/tracking/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "never");

export function McpCard({ siteId, role }) {
  const canManage = can(role, "mcp.manage_tokens");
  const [tokens, setTokens] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [days, setDays] = useState(DEFAULT_EXPIRY_DAYS);
  const [consent, setConsent] = useState(false);
  const [allowPii, setAllowPii] = useState(false);
  const [piiConsent, setPiiConsent] = useState(false);
  const [fresh, setFresh] = useState(null); // { token }, shown once
  const [copied, setCopied] = useState(false);
  const endpoint = typeof window !== "undefined" ? window.location.origin + "/api/mcp" : "/api/mcp";

  async function refresh() {
    const res = await listMcpTokens(siteId);
    if (res.ok) setTokens(res.tokens);
    else setError(res.error);
  }

  useEffect(() => {
    if (!canManage) return;
    let live = true;
    listMcpTokens(siteId).then((res) => {
      if (!live) return;
      if (res.ok) setTokens(res.tokens);
      else setError(res.error);
    });
    return () => {
      live = false;
    };
  }, [siteId, canManage]);

  async function create() {
    setBusy(true);
    setError(null);
    const res = await createMcpToken(siteId, { label, consent, allowPii, piiConsent, expiresInDays: days });
    if (res.ok) {
      setFresh({ token: res.token });
      setLabel("");
      setConsent(false);
      setAllowPii(false);
      setPiiConsent(false);
      await refresh();
    } else setError(res.error);
    setBusy(false);
  }

  async function revoke(id) {
    setBusy(true);
    setError(null);
    const res = await revokeMcpToken(siteId, id);
    if (!res.ok) setError(res.error);
    await refresh();
    setBusy(false);
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy. Select the text and copy it yourself.");
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <div className="text-xs text-muted-foreground">AI access (MCP)</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Let an AI app such as Claude or Cursor ask questions of this site&apos;s Hook data. The app can only read, only this site, and only with a token you create here. Tokens expire and can be revoked at any time.
          </p>
        </div>

        {!canManage && <p className="text-xs text-muted-foreground">Only the site owner or an admin can manage AI access tokens.</p>}

        {canManage && fresh && (
          <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3">
            <div className="text-xs font-medium text-foreground">Copy your token now. It is shown only once.</div>
            <div className="flex gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded bg-black px-2 py-1.5 text-xs text-white">{fresh.token}</code>
              <Button size="xs" variant="outline" onClick={() => copy(fresh.token)}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Claude Code:
              <pre className="mt-1 overflow-x-auto rounded bg-black px-2 py-1.5 text-xs text-white">{"claude mcp add --transport http jellyhook " + endpoint + ' --header "Authorization: Bearer ' + fresh.token + '"'}</pre>
            </div>
            <Button size="xs" variant="outline" onClick={() => setFresh(null)}>
              I have saved it
            </Button>
          </div>
        )}

        {canManage && tokens && tokens.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {tokens.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-1.5">
                <div className="min-w-0">
                  <span className="text-xs font-medium text-foreground">{t.label}</span>
                  <span className="ml-2 font-mono text-[11px] text-muted-foreground">{t.prefix}...</span>
                  <div className="text-[11px] text-muted-foreground">
                    {t.state === "active" ? "expires " + fmt(t.expiresAt) : t.state} · last used {fmt(t.lastUsedAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {t.allowPii && <Badge variant="outline">personal details</Badge>}
                  {t.state === "active" && (
                    <Button size="xs" variant="outline" disabled={busy} onClick={() => revoke(t.id)}>
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {canManage && (
          <div className="space-y-3 rounded-md border p-3">
            <div className="text-xs font-medium text-foreground">Create a token</div>
            <div className="flex flex-wrap gap-2">
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name, for example Claude on my laptop" maxLength={60} className="min-w-[14rem] flex-1" />
              <select className="h-9 rounded-md border bg-background px-2 text-sm" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Expires after">
                {EXPIRY_DAYS.map((d) => (
                  <option key={d} value={d}>
                    expires in {d} days
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>{CONSENT_TEXT}</span>
            </label>
            <label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={allowPii}
                onChange={(e) => {
                  setAllowPii(e.target.checked);
                  if (!e.target.checked) setPiiConsent(false);
                }}
              />
              <span>{PII_CONSENT_TEXT}</span>
            </label>
            {allowPii && (
              <label className="flex items-start gap-2 text-xs leading-relaxed text-warning">
                <input type="checkbox" className="mt-0.5" checked={piiConsent} onChange={(e) => setPiiConsent(e.target.checked)} />
                <span>I confirm that sharing personal details of this site&apos;s visitors with that AI provider is allowed by our privacy policy and the law that applies to us.</span>
              </label>
            )}
            <Button disabled={busy || !label.trim() || !consent || (allowPii && !piiConsent)} onClick={create}>
              Create token
            </Button>
          </div>
        )}
        {error && <div className="text-xs text-destructive">{error}</div>}
      </CardContent>
    </Card>
  );
}
