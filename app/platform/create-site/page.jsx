// app/platform/create-site/page.jsx
// ✅ FIXED: imports createSite from site-management.actions, NOT supabase.actions
// supabase.actions.js still has the old broken createSite with supabase.auth.getUser()
"use client";

import { useState } from "react";
import { createSite } from "@/lib/actions/site-management.actions"; // ← CORRECT import

export default function CreateSitePage() {
  const [domain, setDomain] = useState("");
  const [specifyForm, setSpecifyForm] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  // ── Case: domain exists, user has no access ─────────────────────────────
  if (result?.alreadyExists) {
    return (
      <div className="p-6 max-w-xl space-y-4">
        <h1 className="text-xl font-bold">Domain Already Registered</h1>
        <div className="p-4 border border-amber-300 bg-amber-50 rounded-lg text-sm space-y-2">
          <p className="font-semibold text-amber-800">
            <strong>{result.site.domain}</strong> is already registered on this platform.
          </p>
          <p className="text-amber-700">
            Your email doesn't match this domain automatically. Ask the site owner to invite
            you from their Settings page.
          </p>
        </div>
        <button
          onClick={() => { setResult(null); setDomain(""); }}
          className="text-sm underline text-muted-foreground"
        >
          Try a different domain
        </button>
      </div>
    );
  }

  // ── Case: auto-joined via business email domain match ───────────────────
  if (result?.joined) {
    const script = `<script src="http://localhost:3000/tracker.js" data-key="${result.site.api_key}"></script>`; // 🚀 DEPLOY
    return (
      <div className="p-6 max-w-xl space-y-4">
        <h1 className="text-xl font-bold">Joined Existing Site</h1>
        <div className="p-4 border border-emerald-300 bg-emerald-50 rounded-lg text-sm space-y-2">
          <p className="font-semibold text-emerald-800">
            ✅ Your email matched <strong>{result.site.domain}</strong> — you've been added automatically.
          </p>
          <p className="text-emerald-700">
            The tracker script is already installed. You don't need to add it again.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">Existing script (if you need it):</p>
        <pre className="p-3 border bg-muted rounded text-xs overflow-x-auto">{script}</pre>
        <a href="/platform" className="block text-sm underline text-primary">Go to dashboard →</a>
      </div>
    );
  }

  // ── Case: already a member / already owner trying again ─────────────────
  // ✅ FIXED: now shows the script so they can re-install if needed
  if (result?.alreadyMember) {
    const script = result.site?.api_key
      ? `<script src="http://localhost:3000/tracker.js" data-key="${result.site.api_key}"></script>` // 🚀 DEPLOY
      : null;
    return (
      <div className="p-6 max-w-xl space-y-4">
        <h1 className="text-xl font-bold">You Already Have Access</h1>
        <div className="p-4 border rounded-lg text-sm space-y-1">
          <p>You already have access to <strong>{result.site.domain}</strong>.</p>
          <p className="text-muted-foreground text-xs">
            Your site data and settings are unchanged.
          </p>
        </div>
        {script && (
          <div>
            <p className="text-sm font-medium mb-1">Your tracker script:</p>
            <pre className="p-3 border bg-muted rounded text-xs overflow-x-auto">{script}</pre>
          </div>
        )}
        <a href="/platform" className="block text-sm underline text-primary">Go to dashboard →</a>
      </div>
    );
  }

  // ── Case: domain was registered before but script never installed ────────
  // verified=false means the tracker never sent data — owner is reclaiming
  if (result?.reclaimed) {
    const script = `<script src="http://localhost:3000/tracker.js" data-key="${result.site.api_key}"></script>`; // 🚀 DEPLOY
    return (
      <div className="p-6 max-w-xl space-y-6">
        <h1 className="text-xl font-bold">Site Reclaimed</h1>
        <div className="p-4 border border-emerald-300 bg-emerald-50 rounded-lg text-sm">
          <p className="font-semibold text-emerald-800">
            ✅ You previously registered <strong>{result.site.domain}</strong> but never installed
            the script. Here it is again — your site and API key are unchanged.
          </p>
        </div>
        <div>
          <p className="text-sm font-medium mb-1">
            Paste this before your closing <code className="bg-muted px-1 rounded">&lt;/body&gt;</code> tag:
          </p>
          <pre className="p-3 border bg-muted rounded text-xs overflow-x-auto">{script}</pre>
        </div>
        {result.site.specify_form && (
          <div>
            <p className="text-sm font-medium mb-1">Add to your conversion form:</p>
            <pre className="p-3 border bg-muted rounded text-xs overflow-x-auto">
              {`<form data-conversion="true">\n  ...\n</form>`}
            </pre>
          </div>
        )}
        <a href="/platform" className="block text-sm underline text-primary">Go to dashboard →</a>
      </div>
    );
  }

  // ── Case: new site created ───────────────────────────────────────────────
  if (result?.site && !result.joined) {
    const script = `<script src="http://localhost:3000/tracker.js" data-key="${result.site.api_key}"></script>`; // 🚀 DEPLOY
    return (
      <div className="p-6 max-w-xl space-y-6">
        <h1 className="text-xl font-bold">Tracker Created</h1>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-1">
              Step 1 — Paste this before your closing{" "}
              <code className="bg-muted px-1 rounded">&lt;/body&gt;</code> tag:
            </p>
            <pre className="p-3 border bg-muted rounded text-xs overflow-x-auto">{script}</pre>
          </div>
          {specifyForm && (
            <div>
              <p className="text-sm font-medium mb-1">
                Step 2 — Add this attribute to your conversion form:
              </p>
              <pre className="p-3 border bg-muted rounded text-xs overflow-x-auto">
                {`<form data-conversion="true">\n  ...\n</form>`}
              </pre>
              <p className="text-xs text-muted-foreground mt-1">
                Only this form will be counted as a conversion.
              </p>
            </div>
          )}
        </div>
        <a href="/platform" className="block text-sm underline text-primary">Go to dashboard →</a>
      </div>
    );
  }

  // ── Default: the registration form ──────────────────────────────────────
  return (
    <div className="p-6 max-w-xl space-y-6">
      <h1 className="text-xl font-bold">Add Your Site</h1>

      <div className="space-y-1">
        <label className="text-sm font-medium">Your domain</label>
        <input
          placeholder="yourdomain.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="border p-2 w-full rounded"
        />
        <p className="text-xs text-muted-foreground">
          Without https:// or www
        </p>
      </div>

      <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
        <p className="text-sm font-medium">Do you have a specific conversion form?</p>
        <p className="text-xs text-muted-foreground">
          A contact form, demo request, or sign-up — not a search bar or newsletter.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setSpecifyForm(false)}
            className={`px-4 py-2 rounded text-sm border transition-colors ${
              !specifyForm
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border hover:bg-muted"
            }`}
          >
            No — track all forms
          </button>
          <button
            onClick={() => setSpecifyForm(true)}
            className={`px-4 py-2 rounded text-sm border transition-colors ${
              specifyForm
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border hover:bg-muted"
            }`}
          >
            Yes — I'll label my form
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading || !domain.trim()}
        className="border px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50"
      >
        {loading ? "Checking..." : "Continue"}
      </button>
    </div>
  );
}