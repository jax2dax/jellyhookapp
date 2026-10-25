// lib/settings/sections.js
// The sections of Settings, grouped as they appear in its sidebar (app/platform/settings/SettingsNav.jsx). Pure data and
// two helpers, shared by the server page (which shows only the chosen section) and the sidebar. Replaces the top-bar
// tabs Tracker / Site / Form fields / MCP (2026-10-25): one page of many cards was hard to read, so each section now has
// its own page, reached from a grouped sidebar. Tested: lib/settings/tests/sections.test.js.
//
//   id      the value in the address: /platform/settings?section=<id> (the default has no parameter)
//   flag    optional: the section only shows when this flag is on (flags come from the server, for example MCP_ENABLED)

export const SETTINGS_GROUPS = [
  {
    title: "Workspace",
    items: [{ id: "general", label: "General", description: "The name and domain of this site, and whether it is recording." }],
  },
  {
    title: "Tracking",
    items: [
      { id: "installation", label: "Installation", description: "The script to paste in your site, and the key that connects it to Jellyhook." },
      { id: "connection", label: "Connection", description: "Whether data is arriving, and which websites may send it." },
      { id: "attributes", label: "Attribute check", description: "Whether the optional attributes you put on your pages are found and working." },
    ],
  },
  {
    title: "Forms",
    items: [
      { id: "forms", label: "Lead forms", description: "Which form submissions count as leads." },
      { id: "fields", label: "Form fields", description: "Readable names for your forms' fields, used by marks that look at answers." },
    ],
  },
  {
    title: "Integrations",
    items: [{ id: "ai", label: "AI access", description: "Let an AI app such as Claude or Cursor read this site's data.", flag: "mcp" }],
  },
];

export const DEFAULT_SECTION = "general";

/** Addresses from before the sidebar (?tab=tracker ...) keep working. */
const LEGACY = { tracker: "installation", site: "general", fields: "fields", ai: "ai" };

/** The groups this viewer may see (a section behind a switched-off flag is hidden; an empty group goes with it). */
export function visibleGroups(flags = {}) {
  return SETTINGS_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.flag || flags[i.flag] === true) })).filter((g) => g.items.length > 0);
}

/** The section to show for a raw ?section= (or an old ?tab=) value: it must be visible, otherwise the default. */
export function resolveSection(raw, flags = {}) {
  const ids = visibleGroups(flags).flatMap((g) => g.items.map((i) => i.id));
  const wanted = typeof raw === "string" ? (LEGACY[raw] ?? raw) : null;
  return wanted && ids.includes(wanted) ? wanted : DEFAULT_SECTION;
}

export function sectionById(id) {
  for (const g of SETTINGS_GROUPS) for (const i of g.items) if (i.id === id) return { ...i, group: g.title };
  return null;
}

/** The address of a section; the default keeps a clean address. */
export function sectionHref(id, extra = "") {
  const q = id === DEFAULT_SECTION ? "" : "section=" + id;
  const rest = extra.replace(/^&/, "");
  const all = [q, rest].filter(Boolean).join("&");
  return "/platform/settings" + (all ? "?" + all : "");
}
