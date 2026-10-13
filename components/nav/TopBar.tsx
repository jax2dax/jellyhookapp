// components/nav/TopBar.tsx
// The platform's top bar. Only pages that have secondary tabs (components/nav/navRegistry.ts) get a bar at all; every
// other page starts at the very top of the screen. There is no sidebar button: clicking an empty part of the sidebar
// expands or collapses it (components/app-sidebar.tsx), and Ctrl+B still works.
"use client";

import { usePathname } from "next/navigation";
import { SecondaryNav } from "./SecondaryNav";
import { navFor } from "./navRegistry";

export function TopBar({ flags }: { flags: Record<string, boolean> }) {
  const pathname = usePathname();

  // pages without tabs get no bar: they start at the very top (the sidebar opens and closes by clicking its empty space)
  if (!navFor(pathname)) return null

  return (
    <header className="flex h-12 shrink-0 items-center border-b px-5">
      <SecondaryNav flags={flags} />
    </header>
  );
}
