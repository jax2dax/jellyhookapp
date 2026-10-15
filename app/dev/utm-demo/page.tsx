// app/dev/utm-demo/page.tsx
// DEMO with FAKE data: how lead origins with detailed UTM tags could be processed and shown. Nothing here reads the
// database. It shows every step: the landing URLs as they arrive, how each is parsed and normalized, and the charts
// built from the result (platform first, then the variations inside each platform, then campaign x placement).
// Proposal for the "Leads origin" radar: see the notes on the page.
"use client";

import * as React from "react";
import { Bar, BarChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// ── 1. fake landing URLs (one per converted lead), as the tracker would see them ─────────────────────────
const FAKE: { url: string; referrer?: string }[] = [
  { url: "https://acme.io/?utm_source=reddit&utm_medium=social&utm_campaign=launch_oct&utm_content=r_saas" },
  { url: "https://acme.io/?utm_source=reddit&utm_medium=social&utm_campaign=launch_oct&utm_content=r_saas" },
  { url: "https://acme.io/?utm_source=reddit&utm_medium=social&utm_campaign=launch_oct&utm_content=r_saas" },
  { url: "https://acme.io/pricing?utm_source=reddit&utm_medium=social&utm_campaign=launch_oct&utm_content=r/startups" },
  { url: "https://acme.io/?utm_source=Reddit&utm_medium=social&utm_campaign=launch_oct&utm_content=r-Entrepreneur" },
  { url: "https://acme.io/?utm_source=reddit.com&utm_medium=paid&utm_campaign=retarget_q4&utm_content=r_saas" },
  { url: "https://acme.io/?utm_source=reddit&utm_medium=social&utm_campaign=ama_nov&utm_content=r_marketing" },
  { url: "https://acme.io/?utm_source=facebook&utm_medium=social&utm_campaign=groups_push&utm_content=group_founders_hub" },
  { url: "https://acme.io/?utm_source=fb&utm_medium=social&utm_campaign=groups_push&utm_content=group_founders_hub" },
  { url: "https://acme.io/?utm_source=Facebook&utm_medium=social&utm_campaign=groups_push&utm_content=group_saas_growth" },
  { url: "https://acme.io/?utm_source=facebook&utm_medium=paid&utm_campaign=lookalike_1&utm_content=video_a" },
  { url: "https://acme.io/?utm_source=facebook&utm_medium=paid&utm_campaign=lookalike_1&utm_content=video_b" },
  { url: "https://acme.io/?utm_source=linkedin&utm_medium=social&utm_campaign=founder_posts" },
  { url: "https://acme.io/?utm_source=li&utm_medium=social&utm_campaign=founder_posts&utm_content=carousel" },
  { url: "https://acme.io/?utm_source=linkedin&utm_medium=group&utm_campaign=groups_push&utm_content=group_b2b_sales_leaders" },
  { url: "https://acme.io/?utm_source=google&utm_medium=cpc&utm_campaign=brand&utm_term=acme+crm" },
  { url: "https://acme.io/?utm_source=google&utm_medium=cpc&utm_campaign=competitor&utm_term=hubspot+alternative" },
  { url: "https://acme.io/?utm_source=google&utm_medium=cpc&utm_campaign=competitor&utm_term=hubspot+alternative" },
  { url: "https://acme.io/?utm_source=newsletter&utm_medium=email&utm_campaign=oct_digest&utm_content=hero_button" },
  { url: "https://acme.io/?utm_source=newsletter&utm_medium=email&utm_campaign=oct_digest&utm_content=footer_link" },
  { url: "https://acme.io/blog/guide", referrer: "https://www.google.com/" },
  { url: "https://acme.io/blog/guide", referrer: "https://www.google.com/" },
  { url: "https://acme.io/", referrer: "https://news.ycombinator.com/item?id=1" },
  { url: "https://acme.io/" },
];

// ── 2. parsing and normalizing ─────────────────────────────────────────────────────────────────────────
// Platform: utm_source with aliases merged (fb = Facebook, li = LinkedIn, reddit.com = Reddit); without UTM, the
// referrer's site; without either, Direct. Placement: the most specific "where inside the platform" tag, normalized
// so r_saas, r/saas and r-SaaS are one subreddit, group_founders_hub becomes "Founders Hub (group)".
const ALIASES: Record<string, string> = { fb: "Facebook", facebook: "Facebook", "facebook.com": "Facebook", ig: "Instagram", instagram: "Instagram", li: "LinkedIn", linkedin: "LinkedIn", reddit: "Reddit", "reddit.com": "Reddit", google: "Google", x: "X", twitter: "X", newsletter: "Newsletter" };
const REFERRER_SITES: [RegExp, string][] = [[/google\./, "Google"], [/facebook\./, "Facebook"], [/reddit\./, "Reddit"], [/linkedin\./, "LinkedIn"], [/ycombinator\./, "Hacker News"]];

const titleCase = (s: string) => s.replace(/[-_+]+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());

function placementOf(platform: string, medium: string | null, content: string | null, term: string | null): string | null {
  const c = (content ?? "").trim();
  if (platform === "Reddit" && c) {
    const m = c.toLowerCase().match(/^r[\/_-](.+)$/);
    if (m) return "r/" + m[1].toLowerCase();
  }
  if (/^group[_-]/i.test(c)) return titleCase(c.replace(/^group[_-]/i, "")) + " (group)";
  if (term) return "“" + term.replace(/\+/g, " ") + "”"; // search keyword
  if (c) return titleCase(c);
  return medium ? titleCase(medium) : null;
}

interface Parsed {
  url: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  referrer: string | null;
  platform: string;
  placement: string | null;
  campaignLabel: string | null;
  rule: string;
}

function parse(row: { url: string; referrer?: string }): Parsed {
  const q = new URL(row.url).searchParams;
  const source = q.get("utm_source");
  const medium = q.get("utm_medium");
  const campaign = q.get("utm_campaign");
  const content = q.get("utm_content");
  const term = q.get("utm_term");
  let platform = "Direct";
  let rule = "no UTM, no referrer";
  if (source) {
    const key = source.trim().toLowerCase();
    platform = ALIASES[key] ?? titleCase(key);
    rule = ALIASES[key] && ALIASES[key].toLowerCase() !== key ? "utm_source “" + source + "” merged into " + platform : "utm_source";
  } else if (row.referrer) {
    const host = new URL(row.referrer).hostname;
    platform = REFERRER_SITES.find(([re]) => re.test(host))?.[1] ?? host.replace(/^www\./, "");
    rule = "referrer " + host;
  }
  return { url: row.url, source, medium, campaign, content, term, referrer: row.referrer ?? null, platform, placement: placementOf(platform, medium, content, term), campaignLabel: campaign ? titleCase(campaign) : null, rule };
}

// ── 3. aggregation ─────────────────────────────────────────────────────────────────────────────────────
const TOP = 5; // past this, the rest is grouped as "Other" so a chart never gets unreadable
function countBy<T>(rows: T[], key: (r: T) => string | null) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r) ?? "(not tagged)";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  const all = [...m.entries()].map(([name, leads]) => ({ name, leads })).sort((a, b) => b.leads - a.leads);
  if (all.length <= TOP + 1) return all;
  const rest = all.slice(TOP).reduce((n, x) => n + x.leads, 0);
  return [...all.slice(0, TOP), { name: "Other (" + (all.length - TOP) + ")", leads: rest }];
}

const Code = ({ children }: { children: React.ReactNode }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{children}</code>;

export default function UtmDemoPage() {
  const rows = React.useMemo(() => FAKE.map(parse), []);
  const platforms = countBy(rows, (r) => r.platform);
  const withVariations = platforms.filter((p) => !p.name.startsWith("Other")).map((p) => ({ platform: p.name, total: p.leads, placements: countBy(rows.filter((r) => r.platform === p.name), (r) => r.placement) })).filter((p) => p.placements.length > 1);
  const [focus, setFocus] = React.useState("Reddit");
  const focusRows = rows.filter((r) => r.platform === focus);
  const campaigns = [...new Set(focusRows.map((r) => r.campaignLabel ?? "(no campaign)"))];
  const placements = [...new Set(focusRows.map((r) => r.placement ?? "(not tagged)"))];

  return (
    <div className="mx-auto max-w-6xl space-y-10 p-6">
      <header>
        <div className="text-xs font-medium uppercase tracking-wide text-amber-600">Demo, fake data</div>
        <h1 className="text-xl font-semibold">Lead origins with detailed UTM tags</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {FAKE.length} fake converted leads. Step 1 shows the landing URLs as they arrive, step 2 how each is read, steps 3 to 5 the charts. Nothing here is from the database.
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-base font-semibold">1 + 2. The URLs, and how each is read</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5">Landing URL (and referrer)</th>
                <th className="px-2 py-1.5">source</th>
                <th className="px-2 py-1.5">medium</th>
                <th className="px-2 py-1.5">campaign</th>
                <th className="px-2 py-1.5">content / term</th>
                <th className="px-2 py-1.5">→ Platform</th>
                <th className="px-2 py-1.5">→ Placement</th>
                <th className="px-2 py-1.5">Rule used</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t align-top">
                  <td className="max-w-[18rem] break-all px-2 py-1.5 font-mono text-[10.5px]">
                    {r.url}
                    {r.referrer && <div className="text-muted-foreground">from {r.referrer}</div>}
                  </td>
                  <td className="px-2 py-1.5">{r.source ?? "-"}</td>
                  <td className="px-2 py-1.5">{r.medium ?? "-"}</td>
                  <td className="px-2 py-1.5">{r.campaign ?? "-"}</td>
                  <td className="px-2 py-1.5">{r.content ?? r.term ?? "-"}</td>
                  <td className="px-2 py-1.5 font-medium">{r.platform}</td>
                  <td className="px-2 py-1.5">{r.placement ?? "-"}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-1 text-base font-semibold">3. Where leads come from: the platform only</h2>
          <p className="mb-2 text-xs text-muted-foreground">The first view never splits by variation. fb, Facebook and facebook.com are one axis. A radar is used only while there are 3 to 8 platforms.</p>
          <div className="h-72 rounded-lg border p-2">
            <ResponsiveContainer>
              {platforms.length >= 3 && platforms.length <= 8 ? (
                <RadarChart data={platforms}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <Radar dataKey="leads" fill="#eab308" fillOpacity={0.35} stroke="#eab308" />
                  <Tooltip />
                </RadarChart>
              ) : (
                <BarChart data={platforms} layout="vertical" margin={{ left: 40 }}>
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Bar dataKey="leads" fill="#eab308" />
                  <Tooltip />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
        <div className="text-sm">
          <h3 className="mb-2 font-semibold">Why radar only up to about 8</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>A radar compares a few categories by shape. With 2 axes it is a line, with 12 it is an unreadable star.</li>
            <li>Past 8 platforms the chart switches to a ranked bar list (largest first), which stays readable at any length.</li>
            <li>Inside a platform, variations are always ranked bars: there can be 3 subreddits or 300, and a bar list handles both.</li>
            <li>Top 5 plus &quot;Other&quot; everywhere, so one long tail never pushes the important rows off the screen.</li>
          </ul>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-base font-semibold">4. Inside each platform: the variations</h2>
        <p className="mb-3 text-xs text-muted-foreground">One small chart per platform that has more than one placement. Placement = the subreddit, group, ad, keyword or link, from utm_content (or utm_term for search).</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {withVariations.map((p) => (
            <button key={p.platform} type="button" onClick={() => setFocus(p.platform)} className={"rounded-lg border p-3 text-left " + (focus === p.platform ? "ring-2 ring-amber-500" : "hover:bg-muted/40")}>
              <div className="text-sm font-medium">
                {p.platform} <span className="text-xs text-muted-foreground">{p.total} leads</span>
              </div>
              <div className="h-36">
                <ResponsiveContainer>
                  <BarChart data={p.placements} layout="vertical" margin={{ left: 0, right: 8 }}>
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} />
                    <Bar dataKey="leads" fill="#38bdf8" />
                    <Tooltip />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-base font-semibold">5. One platform, campaign × placement ({focus})</h2>
        <p className="mb-2 text-xs text-muted-foreground">Click a platform above. Many UTM combinations become a small table instead of more charts: rows are campaigns, columns are placements, each cell is a lead count.</p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-1.5 text-left">Campaign</th>
                {placements.map((p) => (
                  <th key={p} className="px-3 py-1.5 text-left font-medium">{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c} className="border-t">
                  <td className="px-3 py-1.5 font-medium">{c}</td>
                  {placements.map((p) => {
                    const n = focusRows.filter((r) => (r.campaignLabel ?? "(no campaign)") === c && (r.placement ?? "(not tagged)") === p).length;
                    return (
                      <td key={p} className="px-3 py-1.5 text-center" style={{ background: n ? "rgba(234,179,8," + Math.min(0.15 + n * 0.2, 0.8) + ")" : undefined }}>
                        {n || ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border bg-muted/20 p-4 text-sm">
        <h2 className="mb-2 font-semibold">What the real product would need</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>The tracker records utm_source, utm_medium and utm_campaign today, NOT utm_content or utm_term. Subreddits, groups, ads and keywords usually live in those two, so they must be recorded first.</li>
          <li>The live chart today title-cases utm_source, so <Code>fb</Code> and <Code>facebook</Code> are two different axes. The alias list above fixes that.</li>
          <li>A short naming guide for customers (one way to write a subreddit or a group) makes the rest reliable; the normalization above catches the common variations.</li>
        </ul>
      </section>
    </div>
  );
}
