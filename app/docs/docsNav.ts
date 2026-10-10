// app/docs/docsNav.ts
// Single source of truth for the docs sidebar. Add a page here when you
// add one under app/docs/. See mds/documentation/roadmap.md for the
// planned order — sections/pages not built yet are commented out, not
// linked, so the sidebar never points at a page that doesn't exist.
export interface DocsNavItem {
  slug: string; // "" = /docs itself
  title: string;
}

export interface DocsNavSection {
  title: string;
  items: DocsNavItem[];
}

export const DOCS_NAV: DocsNavSection[] = [
  {
    title: "Getting started",
    items: [
      { slug: "", title: "Introduction" },
      { slug: "use-cases", title: "What Jellyhook is for" },
      { slug: "installation", title: "Installation and setup" },
    ],
  },
  {
    title: "Core concepts",
    items: [
      { slug: "concepts/visitors-sessions", title: "Visitors, sessions, and page views" },
      { slug: "concepts/leads-qualification", title: "Leads and qualification" },
      { slug: "concepts/form-engagement", title: "Form engagement" },
      { slug: "concepts/tracking-attributes", title: "Tracking attributes" },
      { slug: "concepts/supported-forms", title: "Supported forms" },
      { slug: "concepts/privacy-consent", title: "Privacy and consent" },
      { slug: "concepts/session-replay", title: "Visit chart" },
      { slug: "concepts/referrers-attribution", title: "Referrers and attribution" },
    ],
  },
  {
    title: "Hook",
    items: [
      { slug: "hook", title: "What is Hook" },
      { slug: "hook/building", title: "Build a question" },
      { slug: "hook/connected-rows", title: "Connected rows, groups, journeys" },
      { slug: "hook/sub-hooks", title: "Sub-hooks and tunnels" },
      { slug: "hook/organizing", title: "Organize, share and run" },
      { slug: "hook/ask", title: "Enter Hook with AI" },
      { slug: "hook/examples", title: "Worked examples" },
      { slug: "hook/field-reference", title: "Field reference" },
      { slug: "hook/how-it-works", title: "How Hook works" },
      { slug: "hook/glossary", title: "Glossary" },
    ],
  },
  {
    title: "Preview and results",
    items: [
      { slug: "preview", title: "The preview" },
      { slug: "preview/how-it-works", title: "How the preview works" },
      { slug: "results", title: "The results" },
      { slug: "results/how-it-works", title: "How the results work" },
    ],
  },
  {
    title: "Feature reference",
    items: [
      { slug: "reference/dashboard", title: "Dashboard overview" },
      { slug: "reference/leads", title: "Leads page" },
      { slug: "reference/lead-profile", title: "Lead profile page" },
      { slug: "reference/conversions", title: "Conversions page" },
      { slug: "reference/settings", title: "Site settings" },
      { slug: "reference/team", title: "Team and invites" },
      { slug: "reference/billing", title: "Billing and plans" },
    ],
  },
  {
    title: "Troubleshooting",
    items: [{ slug: "troubleshooting", title: "Troubleshooting" }],
  },
];
