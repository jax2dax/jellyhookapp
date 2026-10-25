// components/nav/navRegistry.ts
// The registry behind the secondary navigation in the platform's top bar. One entry per sidebar page that wants
// tabs. Pure data + two helpers, shared by the top bar (components/nav/SecondaryNav.tsx) and by the page itself,
// which reads `?tab=` on the server and shows only that tab's cards. To add tabs to another page: add an entry here
// and make the page honour `?tab=` (see app/platform/settings/page.jsx). A page with no entry shows no tabs.
//
//   id      the value in the address (?tab=<id>); the default tab has no parameter at all
//   flag    optional: the tab only shows when this flag is on (flags come from the server layout, for example MCP_ENABLED)
export interface NavItem {
  id: string;
  label: string;
  flag?: string;
}

export interface PageNav {
  /** Shown before the tabs, so the bar says which page you are on. */
  title: string;
  /** The tab shown when the address has no ?tab=. */
  defaultId: string;
  items: NavItem[];
}

export const SECONDARY_NAV: Record<string, PageNav> = {
  "/platform/hooks": {
    title: "Hooks",
    defaultId: "hooked",
    items: [
      { id: "hooked", label: "Hooked leads" }, // every lead a hook caught
      { id: "rules", label: "Hooks" }, // the hooks: which marks, who is told, where; on / off
    ],
  },
  "/platform/settings": {
    title: "Settings",
    defaultId: "tracker",
    items: [
      { id: "tracker", label: "Tracker" }, // script, key, hosts, health, how forms are counted
      { id: "site", label: "Site" }, // name, domain, overview, leaving the site
      { id: "fields", label: "Form fields" }, // names of the site's form fields, for marks on answers
      { id: "ai", label: "MCP", flag: "mcp" }, // AI access tokens, last
    ],
  },
};

/** The registry entry for a path (exact match, or a sub-page of a registered page). */
export function navFor(pathname: string): PageNav | null {
  const hit = Object.keys(SECONDARY_NAV)
    .sort((a, b) => b.length - a.length)
    .find((p) => pathname === p || pathname.startsWith(p + "/"));
  return hit ? SECONDARY_NAV[hit] : null;
}

/** The tabs this viewer may see (a tab behind a switched-off flag is hidden). */
export function visibleItems(nav: PageNav, flags: Record<string, boolean>): NavItem[] {
  return nav.items.filter((i) => !i.flag || flags[i.flag] === true);
}

/** The tab to show for a raw ?tab= value: it must be a visible tab, otherwise the default. */
export function resolveTab(nav: PageNav, raw: string | null | undefined, flags: Record<string, boolean>): string {
  const ids = visibleItems(nav, flags).map((i) => i.id);
  return raw && ids.includes(raw) ? raw : nav.defaultId;
}
