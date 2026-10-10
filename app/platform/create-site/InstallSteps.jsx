// app/platform/create-site/InstallSteps.jsx
"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { STARTER_FORM } from "./starterForm.mjs";

// Colour code used in every snippet:
//   blue   = what Jellyhook gives you: add it
//   gray   = code that is already in the person's file (shown for context)
//   green  = the one attribute that marks the form (data-conversion="true")
// In a snippet, «text» is blue and ‹text› is green. Unmarked text is gray, or blue when tone="ours".
function strip(code) {
  return code.replace(/[«»‹›]/g, "");
}

function renderLine(line, tone) {
  const base = tone === "ours" ? "text-sky-400" : "text-zinc-500";
  return line.split(/(«[^»]*»|‹[^›]*›)/g).map((part, i) => {
    if (part.startsWith("«")) return <span key={i} className="text-sky-400">{part.slice(1, -1)}</span>;
    if (part.startsWith("‹")) return <span key={i} className="font-semibold text-emerald-400">{part.slice(1, -1)}</span>;
    return <span key={i} className={base}>{part}</span>;
  });
}

// One snippet on a black background, with an icon-only Copy button in the top-right corner. When `tabs` is
// given, the switcher is the header strip of this same box (attached to its top edge), with the copy icon at
// the strip's right end.
// copyText overrides what is copied (for a snippet that shows surrounding code, only the lines to ADD are
// copied, so a whole file is never pasted over someone's own).
export function CodeBox({ code, copyText, tone = "context", tabs }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = copyText ?? strip(code);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const copyControl = (
    <span className="flex items-center gap-1.5">
      <span aria-live="polite" className={`text-[10px] font-medium text-emerald-400 transition-opacity ${copied ? "opacity-100" : "opacity-0"}`}>
        {copied ? "Copied" : ""}
      </span>
      <button type="button" onClick={copy} aria-label="Copy" title="Copy" className="rounded p-1 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );

  return (
    <div className="relative mb-3 overflow-hidden rounded-md border border-white/10 bg-black">
      {tabs ? (
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] pr-1.5">
          <div role="tablist" className="flex">
            {tabs.options.map((o) => (
              <button
                key={o.id}
                type="button"
                role="tab"
                aria-selected={tabs.value === o.id}
                onClick={() => tabs.onChange(o.id)}
                className={`px-3 py-1 text-[11px] transition-colors ${tabs.value === o.id ? "bg-black text-white" : "text-zinc-500 opacity-60 hover:opacity-100"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {copyControl}
        </div>
      ) : (
        <div className="absolute top-1.5 right-1.5">{copyControl}</div>
      )}
      <pre className={`overflow-x-auto p-3 text-xs leading-relaxed whitespace-pre-wrap break-all ${tabs ? "" : "pr-16"}`}>
        <code>
          {code.split("\n").map((line, i) => (
            <div key={i}>{renderLine(line, tone) || " "}</div>
          ))}
        </code>
      </pre>
    </div>
  );
}

function scriptTag(base, key) {
  return `<script defer src="${base}/tracker.js" data-key="${key}"></script>`;
}

function stepOneSnippets(base, key) {
  const tag = scriptTag(base, key);
  const jsx = `<Script src="${base}/tracker.js" data-key="${key}" strategy="afterInteractive" />`;
  return {
    html: {
      note: "Paste the line inside the <head> of every page, usually in your layout or header file.",
      code: `<head>\n  <!-- your existing tags -->\n  «${tag}»\n</head>`,
      copy: tag,
    },
    nextapp: {
      note: "Add the import and the tag to your root layout.",
      code: `// app/layout.tsx\n«import Script from "next/script";»\n\nexport default function RootLayout({ children }) {\n  return (\n    <html lang="en">\n      <body>\n        {children}\n        «${jsx}»\n      </body>\n    </html>\n  );\n}`,
      copy: `import Script from "next/script";\n\n${jsx}`,
    },
    nextpages: {
      note: "Add the import and the tag to pages/_app.tsx.",
      code: `// pages/_app.tsx\n«import Script from "next/script";»\n\nexport default function App({ Component, pageProps }) {\n  return (\n    <>\n      <Component {...pageProps} />\n      «${jsx}»\n    </>\n  );\n}`,
      copy: `import Script from "next/script";\n\n${jsx}`,
    },
    vite: {
      note: "Paste the line inside <head> in index.html, at the root of your project. It works for React, Vue and any Vite app.",
      code: `<!-- index.html -->\n<head>\n  <meta charset="UTF-8" />\n  «${tag}»\n</head>`,
      copy: tag,
    },
  };
}

const HUBSPOT = `<div ‹data-conversion="true"›>\n  <script src="//js.hsforms.net/forms/embed/v2.js"></script>\n  <script>\n    hbspt.forms.create({ portalId: "YOUR_PORTAL_ID", formId: "YOUR_FORM_ID" });\n  </script>\n</div>`;
const OWN_FORM = `<form ‹data-conversion="true"› action="/your-endpoint" method="post">\n  <!-- your fields, unchanged -->\n</form>`;
const STARTER_COLORED = STARTER_FORM.replace('data-conversion="true"', '‹data-conversion="true"›');

const FRAMEWORKS = [
  { id: "html", label: "HTML / any site" },
  { id: "nextapp", label: "Next.js (App)" },
  { id: "nextpages", label: "Next.js (Pages)" },
  { id: "vite", label: "Vite / React" },
];
// HubSpot first: it is the one people ask about. The others stay quieter (see CodeBox tabs).
const FORM_KINDS = [
  { id: "hubspot", label: "I have a HubSpot form" },
  { id: "own", label: "Regular form" },
  { id: "starter", label: "Give me a form" },
];

export function InstallSteps({ apiKey, trackerBase, specifyForm }) {
  const [framework, setFramework] = useState("html");
  const [formKind, setFormKind] = useState("hubspot");
  const snippets = stepOneSnippets(trackerBase, apiKey);
  const current = snippets[framework];

  return (
    <div className="mt-5 space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">1</span>
          Add the script to your site
        </div>
        <p className="mb-2 text-[11px] text-muted-foreground">{current.note}</p>
        <CodeBox code={current.code} copyText={current.copy} tabs={{ options: FRAMEWORKS, value: framework, onChange: setFramework }} />
      </div>

      {specifyForm ? (
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">2</span>
            Mark the form you want tracked
          </div>
          <p className="mb-2 text-[11px] text-muted-foreground">
            {formKind === "hubspot" && "HubSpot builds its form itself, so wrap the embed in an element that carries the attribute. Keep your own portal and form ids."}
            {formKind === "own" && "Add one attribute to the form you already have. Everything else stays as it is."}
            {formKind === "starter" && "A simple contact form with no styling to fight. Paste it where you want it. It records the lead in Jellyhook and shows a thank-you message."}
          </p>
          <CodeBox
            code={formKind === "hubspot" ? HUBSPOT : formKind === "own" ? OWN_FORM : STARTER_COLORED}
            copyText={formKind === "starter" ? STARTER_FORM : 'data-conversion="true"'}
            tone={formKind === "starter" ? "ours" : "context"}
            tabs={{ options: FORM_KINDS, value: formKind, onChange: setFormKind }}
          />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Every form on your site is tracked, so there is nothing else to add.</p>
      )}
    </div>
  );
}
