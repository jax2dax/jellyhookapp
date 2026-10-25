// components/showcase/sampleSite.ts
// The made-up site behind the home page demo: a small design studio's pages, their headings, its contact form's
// fields, and twelve leads with the visits they made before sending the form. Every number here is invented and the
// demo says so on screen ("Sample data"). Shapes follow the real ones (jh-marks/v2/check.ts Journey, lib/forms/catalog.ts
// CatalogField), so the real mark checker reads them exactly as it reads a real lead.
import type { CatalogField } from "@/lib/forms/catalog";
import type { PageHeading } from "@/lib/actions/pageHeadings.action";
import type { JForm, JPage, JSession, Journey } from "@/jh-marks/v2/check";
import type { LeadRow } from "@/components/leads/LeadsTable";

export const SAMPLE_PAGES = ["/", "/pricing", "/services", "/case-studies", "/case-studies/fintech-rebrand", "/about", "/contact", "/blog/landing-page-checklist"];

/** [key, tag, text] per page, in page order. Keys follow the tracker's format (short, lowercase). */
const HEADINGS: Record<string, [string, string, string][]> = {
  "/": [["hm1", "h1", "Websites that bring in leads"], ["hm2", "h2", "Selected work"], ["hm3", "h2", "How we work"], ["hm4", "h2", "What clients say"]],
  "/pricing": [["pr1", "h1", "Plans and pricing"], ["pr2", "h2", "Starter"], ["pr3", "h2", "Growth"], ["pr4", "h2", "Custom"], ["pr5", "h2", "What is included"], ["pr6", "h2", "Questions"]],
  "/services": [["sv1", "h1", "Services"], ["sv2", "h2", "Brand identity"], ["sv3", "h2", "Web design"], ["sv4", "h2", "Development"]],
  "/case-studies": [["cs1", "h1", "Case studies"], ["cs2", "h2", "Fintech rebrand"], ["cs3", "h2", "Clinic booking site"]],
  "/case-studies/fintech-rebrand": [["fr1", "h1", "Rebuilding a fintech site"], ["fr2", "h2", "The problem"], ["fr3", "h2", "What we did"], ["fr4", "h2", "Results"]],
  "/about": [["ab1", "h1", "About the studio"], ["ab2", "h2", "The team"]],
  "/contact": [["ct1", "h1", "Tell us about your project"]],
  "/blog/landing-page-checklist": [["bl1", "h1", "A landing page checklist"], ["bl2", "h2", "Above the fold"], ["bl3", "h2", "The form"]],
};

export function headingsOf(path: string): PageHeading[] {
  return (HEADINGS[path] ?? []).map(([key, tag, text]) => ({ key, tag, text }));
}

const field = (raw: string, name: string, kind: "choice" | "text", options: string[]): CatalogField => ({
  key: "custom:" + raw,
  rawKey: raw,
  name,
  ownName: name,
  pageLabel: name,
  unnamed: false,
  type: kind === "text" ? "textarea" : "select",
  kind,
  options: options.map((l) => ({ v: l, l })),
  min: null,
  max: null,
  forms: ["contact"],
  pages: ["/contact"],
  answered: 12,
  sampled: 12,
});

export const SAMPLE_FIELDS: CatalogField[] = [
  field("budget", "Budget", "choice", ["Under $10k", "$10k-$20k", "$20k+"]),
  field("company_size", "Company size", "choice", ["1-10", "11-50", "51-200", "200+"]),
  field("service", "Service", "choice", ["Brand", "Website", "Brand and website"]),
  field("message", "Message", "text", []),
];

/** [path, seconds on the page, share seen %, seconds per heading] */
type P = [string, number, number, Record<string, number>?];
interface V {
  /** hours before now that the visit started */
  ago: number;
  ref: string | null;
  utm?: string;
  pages: P[];
}
interface SampleLead {
  name: string;
  company: string;
  budget: string;
  size: string;
  service: string;
  message: string;
  device: "desktop" | "mobile";
  qualified: boolean | null;
  /** oldest first; the last one is the visit they sent the form in, ending on /contact */
  visits: V[];
  /** seconds from the first key to sending, and whether they left the form while filling it */
  fill: [number, boolean];
}

// Five read /pricing for 30 s or more in the visit they sent the form in (the tour's "Pricing reader"); five came back
// more than once; three picked the top budget.
const LEADS: SampleLead[] = [
  {
    name: "Anna Kebede", company: "northwind", budget: "$20k+", size: "51-200", service: "Brand and website", message: "We are rebranding in Q1 and need the site to match.", device: "desktop", qualified: true, fill: [94, false],
    visits: [
      { ago: 30, ref: "google.com", pages: [["/", 22, 64], ["/case-studies", 41, 80], ["/case-studies/fintech-rebrand", 118, 96, { fr2: 20, fr3: 54, fr4: 31 }]] },
      { ago: 2.2, ref: null, pages: [["/pricing", 72, 100, { pr1: 6, pr3: 28, pr4: 19, pr5: 15 }], ["/about", 25, 70], ["/contact", 140, 100]] },
    ],
  },
  {
    name: "Tom Reyes", company: "brightline", budget: "Under $10k", size: "1-10", service: "Website", message: "Need a simple site for a new cafe.", device: "mobile", qualified: null, fill: [62, false],
    visits: [{ ago: 3.4, ref: "instagram.com", pages: [["/", 14, 45], ["/pricing", 12, 38, { pr1: 4, pr2: 6 }], ["/contact", 80, 100]] }],
  },
  {
    name: "Marco Bianchi", company: "fieldwork", budget: "$10k-$20k", size: "11-50", service: "Website", message: "Our site is slow and does not convert. Can you help?", device: "desktop", qualified: true, fill: [121, true],
    visits: [{ ago: 5.1, ref: "google.com", utm: "google", pages: [["/blog/landing-page-checklist", 96, 88, { bl2: 30, bl3: 41 }], ["/services", 33, 72], ["/pricing", 48, 92, { pr1: 5, pr3: 22, pr5: 12 }], ["/contact", 170, 100]] }],
  },
  {
    name: "Sara Lind", company: "oakmere", budget: "Under $10k", size: "1-10", service: "Brand", message: "Looking for a logo and a small brand guide.", device: "desktop", qualified: null, fill: [55, false],
    visits: [{ ago: 7.8, ref: "linkedin.com", pages: [["/", 18, 52], ["/services", 40, 81, { sv2: 25 }], ["/contact", 75, 100]] }],
  },
  {
    name: "Lina Haddad", company: "quarry", budget: "$20k+", size: "200+", service: "Brand and website", message: "Procurement needs three quotes by the end of the month.", device: "desktop", qualified: true, fill: [210, true],
    visits: [
      { ago: 52, ref: "linkedin.com", utm: "linkedin", pages: [["/", 30, 70], ["/pricing", 64, 100, { pr3: 20, pr4: 30 }]] },
      { ago: 20, ref: null, pages: [["/case-studies", 52, 90], ["/case-studies/fintech-rebrand", 140, 100, { fr3: 70, fr4: 44 }]] },
      { ago: 9.5, ref: null, pages: [["/pricing", 95, 100, { pr1: 4, pr4: 51, pr5: 26, pr6: 10 }], ["/contact", 230, 100]] },
    ],
  },
  {
    name: "Joe Park", company: "kiteworks", budget: "$10k-$20k", size: "11-50", service: "Website", message: "Can you rebuild our site in Webflow?", device: "mobile", qualified: null, fill: [88, false],
    visits: [
      { ago: 70, ref: "google.com", pages: [["/pricing", 80, 96, { pr2: 22, pr3: 35 }], ["/services", 20, 50]] },
      { ago: 12, ref: null, pages: [["/", 9, 30], ["/contact", 100, 100]] },
    ],
  },
  {
    name: "Ruth Alemu", company: "meridian", budget: "$20k+", size: "51-200", service: "Website", message: "We need a site for a product launch in March.", device: "desktop", qualified: null, fill: [133, false],
    visits: [{ ago: 14, ref: "google.com", utm: "google", pages: [["/", 26, 60], ["/case-studies", 30, 66], ["/pricing", 18, 55, { pr1: 4, pr4: 9 }], ["/contact", 160, 100]] }],
  },
  {
    name: "Mia Chen", company: "loomwell", budget: "$10k-$20k", size: "11-50", service: "Brand and website", message: "Is a 6 week timeline possible?", device: "desktop", qualified: null, fill: [70, false],
    visits: [{ ago: 19, ref: "bing.com", pages: [["/pricing", 34, 81, { pr1: 3, pr3: 18 }], ["/contact", 95, 100]] }],
  },
  {
    name: "Ivan Petrov", company: "copperleaf", budget: "Under $10k", size: "1-10", service: "Website", message: "Quote for a one page site please.", device: "mobile", qualified: false, fill: [21, false],
    visits: [{ ago: 23, ref: null, pages: [["/contact", 35, 100]] }],
  },
  {
    name: "Nora Quinn", company: "halcyon", budget: "$10k-$20k", size: "51-200", service: "Website", message: "We compared three studios. Yours is the one we want to talk to.", device: "desktop", qualified: null, fill: [105, false],
    visits: [
      { ago: 98, ref: "google.com", pages: [["/blog/landing-page-checklist", 120, 94, { bl2: 44, bl3: 50 }]] },
      { ago: 27, ref: null, pages: [["/", 15, 48], ["/pricing", 61, 100, { pr1: 5, pr3: 31, pr6: 14 }], ["/contact", 150, 100]] },
    ],
  },
  {
    name: "Ben Okafor", company: "tidewater", budget: "Under $10k", size: "11-50", service: "Brand", message: "Small refresh of our logo.", device: "desktop", qualified: null, fill: [48, false],
    visits: [{ ago: 31, ref: "facebook.com", pages: [["/", 12, 40], ["/about", 20, 60], ["/contact", 70, 100]] }],
  },
  {
    name: "Dawit Tesfaye", company: "summitry", budget: "$10k-$20k", size: "11-50", service: "Website", message: "Following up on our call last month.", device: "desktop", qualified: null, fill: [66, false],
    visits: [
      { ago: 140, ref: "google.com", pages: [["/", 20, 55], ["/services", 45, 85]] },
      { ago: 36, ref: null, pages: [["/case-studies", 25, 60], ["/contact", 90, 100]] },
    ],
  },
];

export interface SampleData {
  leads: LeadRow[];
  journeys: Map<string, Journey>;
}

/** The leads (newest first) and their journeys, timed against `now`. */
export function buildSample(now: number): SampleData {
  const out: { row: LeadRow; journey: Journey }[] = [];
  LEADS.forEach((l, li) => {
    const id = "sample-" + (li + 1);
    const sessions: JSession[] = [];
    let submittedAt = 0;
    l.visits.forEach((v, vi) => {
      const startedAt = Math.round(now - v.ago * 3_600_000);
      let t = startedAt;
      const pages: JPage[] = v.pages.map(([path, sec, seen, heads]) => {
        const headings = new Map(Object.entries(heads ?? {}).map(([k, s]) => [k, s * 1000] as [string, number]));
        const p: JPage = { path, enteredAt: t, ms: sec * 1000, seenPct: seen, headings, headingTotalMs: [...headings.values()].reduce((a, b) => a + b, 0) };
        t += sec * 1000;
        return p;
      });
      sessions.push({ id: `${id}-v${vi + 1}`, number: vi + 1, startedAt, ms: t - startedAt, referrer: v.ref ? "https://" + v.ref + "/" : null, utmSource: v.utm ?? null, pages });
      if (vi === l.visits.length - 1) submittedAt = t;
    });
    const conv = sessions[sessions.length - 1];
    const contact = conv.pages[conv.pages.length - 1];
    const [fillSec, left] = l.fill;
    const firstInputAt = submittedAt - fillSec * 1000;
    const keys = SAMPLE_FIELDS.map((f) => f.key);
    const form: JForm = {
      viewedAt: contact.enteredAt + 4000,
      firstInputAt,
      endedAt: submittedAt,
      fieldKeys: ["name", "email", ...keys],
      timings: Object.fromEntries(
        ["name", "email", ...keys].map((k, n) => [k, { firstFocusAt: firstInputAt + n * 9000, firstKeyAt: firstInputAt + n * 9000 + 1200 + ((li * 7 + n * 3) % 5) * 900, focusedMs: 6000 + ((li + n) % 4) * 5000, edits: (li + n) % 3, errors: 0, filled: true }]),
      ),
      leftWhileFilling: left,
    };
    const email = l.name.split(" ")[0].toLowerCase() + "@" + l.company + ".example.com";
    const answers = { name: l.name, email, budget: l.budget, company_size: l.size, service: l.service, message: l.message };
    out.push({
      row: { id, name: l.name, email, page_path: "/contact", submitted_at: new Date(submittedAt).toISOString(), qualified: l.qualified },
      journey: { leadId: id, submittedAt, convertingSessionId: conv.id, sessions, device: l.device, answers, form },
    });
  });
  out.sort((a, b) => b.journey.submittedAt - a.journey.submittedAt);
  return { leads: out.map((x) => x.row), journeys: new Map(out.map((x) => [x.row.id, x.journey])) };
}
