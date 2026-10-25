"use client";
// app/platform/settings/SettingsNav.jsx
// The grouped sidebar of Settings (sections: lib/settings/sections.js). A vertical list with small group headings on wide
// screens; on narrow screens the same links become one scrollable row, so the sections are never a wall of cards on a
// phone either. The active section comes from the server (the address), so a link is a plain page load of that section.
import { AppLink as Link } from "@/components/sandbox/sandbox";

export function SettingsNav({ groups, active }) {
  return (
    <nav aria-label="Settings sections" className="shrink-0 lg:sticky lg:top-6 lg:w-52 lg:self-start">
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-6 lg:overflow-visible lg:px-0 lg:pb-0">
        {groups.map((g) => (
          <div key={g.title} className="flex shrink-0 gap-1 lg:flex-col lg:gap-0.5">
            <div className="hidden px-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase lg:block">{g.title}</div>
            {g.items.map((item) => {
              const isActive = item.id === active;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={
                    "shrink-0 rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors " +
                    (isActive ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
