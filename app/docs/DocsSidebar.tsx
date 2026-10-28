// app/docs/DocsSidebar.tsx
// Left nav for every /docs page. Plain and static on purpose, not the
// full app Sidebar primitive (components/ui/sidebar.tsx) — that one is
// built for the collapsible, provider-based dashboard shell, and a docs
// nav doesn't need any of that, just a list of links with an active state.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS_NAV } from "./docsNav";

function hrefFor(slug: string) {
  return slug ? `/docs/${slug}` : "/docs";
}

export function DocsSidebar() {
  const pathname = usePathname();
  const current = DOCS_NAV.flatMap((s) => s.items).find((i) => hrefFor(i.slug) === pathname);

  return (
    <>
      {/* phones and tablets: a folded menu above the page, so the content keeps the full width */}
      <details key={pathname} className="border-y-2 border-[var(--ink)] lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between py-3 ff-body text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--ink)] marker:content-none">
          <span>Docs{current ? <span className="ml-2 font-normal normal-case tracking-normal text-[var(--ink-soft)]">{current.title}</span> : null}</span>
          <span aria-hidden>Menu</span>
        </summary>
        <div className="max-h-[60vh] overflow-y-auto pb-4">
          <Links pathname={pathname} />
        </div>
      </details>
      <nav className="hidden w-56 shrink-0 border-r border-[var(--rule)] pr-6 lg:block">
        <Links pathname={pathname} />
      </nav>
    </>
  );
}

function Links({ pathname }: { pathname: string }) {
  return (
    <>
      {DOCS_NAV.map((section) => (
        <div key={section.title} className="mb-6">
          <div className="mb-2 ff-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ink-mute)]">{section.title}</div>
          <ul className="space-y-1">
            {section.items.map((item) => {
              const href = hrefFor(item.slug);
              const isActive = pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`block rounded px-2 py-1.5 ff-body text-[13px] leading-tight ${
                      isActive ? "bg-[var(--paper-2)] font-semibold text-[var(--lime)]" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}
