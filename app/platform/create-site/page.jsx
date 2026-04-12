// platform/create-site/page.jsx
"use client";

import { useState } from "react";
import { createSite } from "@/lib/actions/supabase.actions";

export default function CreateSitePage() {
  const [domain, setDomain] = useState("");
  const [specifyForm, setSpecifyForm] = useState(false); // false = global mode (default)
  const [script, setScript] = useState("");
  const [attributeSnippet, setAttributeSnippet] = useState("");

  const handleSubmit = async () => {
    // Pass specify_form into createSite — add this field to your createSite action
    const site = await createSite({
      name: domain,
      domain,
      specify_form: specifyForm,
    });

    const trackerScript = `<script src="http://localhost:3000/tracker.js" data-key="${site.api_key}"></script>`; // 🚀 DEPLOY: replace domain

    setScript(trackerScript);

    // Only show the form attribute snippet when specify_form mode is on
    if (specifyForm) {
      setAttributeSnippet(`data-conversion="true"`);
    }
  };

  return (
    <div className="p-6 max-w-xl space-y-6">
      <h1 className="text-xl font-bold">Create Tracker</h1>

      <div className="space-y-1">
        <label className="text-sm font-medium">Your domain</label>
        <input
          placeholder="yourdomain.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="border p-2 w-full rounded"
        />
      </div>

      {/* ── Onboarding question for specify_form ─────────────────────── */}
      <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
        <p className="text-sm font-medium">
          Do you have a specific form you consider a conversion?
        </p>
        <p className="text-xs text-muted-foreground">
          For example: a contact form, a demo request, or a sign-up form — but
          NOT a newsletter or search bar.
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
            Yes — I'll label my conversion form
          </button>
        </div>

        {specifyForm && (
          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 space-y-1">
            <p className="font-semibold">You chose: label your conversion form</p>
            <p>
              After generating your script, add{" "}
              <code className="bg-amber-100 px-1 rounded font-mono">
                data-conversion=&quot;true&quot;
              </code>{" "}
              to the{" "}
              <code className="bg-amber-100 px-1 rounded font-mono">&lt;form&gt;</code>{" "}
              element you want tracked as a conversion.
              All other forms on your site will be ignored.
            </p>
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        className="border px-4 py-2 rounded bg-primary text-primary-foreground"
      >
        Generate Script
      </button>

      {script && (
        <div className="space-y-4 mt-4">
          {/* Step 1 — paste script tag */}
          <div>
            <p className="text-sm font-medium mb-1">
              Step 1 — Paste this before your closing{" "}
              <code className="bg-muted px-1 rounded">&lt;/body&gt;</code> tag:
            </p>
            <pre className="p-3 border bg-muted rounded text-xs overflow-x-auto">{script}</pre>
          </div>

          {/* Step 2 — only shown in specify_form mode */}
          {specifyForm && attributeSnippet && (
            <div>
              <p className="text-sm font-medium mb-1">
                Step 2 — Add this attribute to your conversion{" "}
                <code className="bg-muted px-1 rounded">&lt;form&gt;</code>:
              </p>
              <pre className="p-3 border bg-muted rounded text-xs overflow-x-auto">
                {`<form ${attributeSnippet}>\n  ...\n</form>`}
              </pre>
              <p className="text-xs text-muted-foreground mt-1">
                Only this form will be counted as a conversion. All others will be ignored.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}