// components/nav/SecondaryNav.tsx
// The secondary navigation in the platform's top bar: the tabs of whichever sidebar page is open. Reads the address
// (path + ?tab=), looks the page up in the registry (navRegistry.ts) and renders its tabs as links. Clicking only
// changes ?tab=; the page re-renders on the server with that tab's cards. Renders nothing for a page with no entry.
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { navFor, resolveTab, visibleItems } from "./navRegistry";

export function SecondaryNav({ flags }: { flags: Record<string, boolean> }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const nav = navFor(pathname);
  if (!nav) return null;

  const active = resolveTab(nav, params.get("tab"), flags);

  return (
    <nav aria-label={nav.title + " sections"} className="flex min-w-0 items-center gap-1 overflow-x-auto">
      <span className="mr-2 shrink-0 text-sm font-semibold text-foreground">{nav.title}</span>
      {visibleItems(nav, flags).map((item) => {
        const isActive = item.id === active;
        // the default tab keeps a clean address; other query parameters are left alone
        const next = new URLSearchParams(params.toString());
        if (item.id === nav.defaultId) next.delete("tab");
        else next.set("tab", item.id);
        const qs = next.toString();
        return (
          <Link
            key={item.id}
            href={qs ? pathname + "?" + qs : pathname}
            replace
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={
              "shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors " +
              (isActive ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
