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

// Grouped by what the reader is doing (2026-10-25): set up; work with leads; get told about them; read the
// site's numbers; understand how it measures; manage the workspace. The query builder (Hook) comes after the daily
// features: the app hides it from the sidebar for now (components/nav/sidebarItems.ts), but /platform/hook works.
// URLs never change when a page moves between sections.
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
    title: "Leads",
    items: [
      { slug: "reference/leads", title: "Leads page" },
      { slug: "reference/lead-profile", title: "Lead profile page" },
      { slug: "reference/marks", title: "Marks" },
      { slug: "reference/groups", title: "Lead groups" },
      { slug: "reference/form-fields", title: "Form fields" },
    ],
  },
  {
    title: "Hooks and integrations",
    items: [
      { slug: "reference/notifications", title: "Hooks and notifications" },
      { slug: "reference/hubspot", title: "HubSpot" },
    ],
  },
  {
    title: "Analytics",
    items: [
      { slug: "reference/dashboard", title: "Dashboard overview" },
      { slug: "reference/conversions", title: "Conversions page" },
      { slug: "reference/acquisition", title: "Acquisition" },
      { slug: "guides/ad-tracking", title: "Set up ad tracking" },
    ],
  },
  {
    title: "Core concepts",
    items: [
      { slug: "concepts/visitors-sessions", title: "Visitors, sessions, and page views" },
      { slug: "concepts/leads-qualification", title: "Leads and qualification" },
      { slug: "concepts/session-replay", title: "Visit chart" },
      { slug: "concepts/form-engagement", title: "Form engagement" },
      { slug: "concepts/referrers-attribution", title: "Referrers and attribution" },
      { slug: "concepts/supported-forms", title: "Supported forms" },
      { slug: "concepts/tracking-attributes", title: "Tracking attributes" },
    ],
  },
  {
    title: "Privacy and data",
    items: [
      { slug: "concepts/privacy-consent", title: "Privacy and consent" },
      { slug: "concepts/sensitive-fields", title: "Sensitive fields" },
    ],
  },
  {
    title: "Workspace",
    items: [
      { slug: "reference/settings", title: "Site settings" },
      { slug: "reference/team", title: "Team and invites" },
      { slug: "reference/billing", title: "Billing and plans" },
    ],
  },
  {
    title: "Query builder (Hook)",
    items: [
      { slug: "hook", title: "What is Hook" },
      { slug: "hook/building", title: "Build a question" },
      { slug: "hook/connected-rows", title: "Connected rows, groups, journeys" },
      { slug: "hook/sub-hooks", title: "Sub-hooks and tunnels" },
      { slug: "hook/organizing", title: "Organize, share and run" },
      { slug: "hook/ask", title: "Enter Hook with AI" },
      { slug: "hook/examples", title: "Worked examples" },
      { slug: "hook/mcp", title: "Connect an AI app" },
      { slug: "preview", title: "The preview" },
      { slug: "preview/how-it-works", title: "How the preview works" },
      { slug: "results", title: "The results" },
      { slug: "results/how-it-works", title: "How the results work" },
      { slug: "hook/field-reference", title: "Field reference" },
      { slug: "hook/how-it-works", title: "How Hook works" },
      { slug: "hook/glossary", title: "Glossary" },
    ],
  },
  {
    title: "Troubleshooting",
    items: [{ slug: "troubleshooting", title: "Troubleshooting" }],
  },
];
