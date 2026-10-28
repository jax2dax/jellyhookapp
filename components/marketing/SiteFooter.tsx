// components/marketing/SiteFooter.tsx
// Shared footer for the public marketing pages, in the home page's magazine look.
import Link from "next/link";

const FOOTER_LINKS = [
  { label: "Docs", href: "/docs" },
  { label: "Pricing", href: "/pricing" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "About", href: "/about" },
];

export function SiteFooter() {
  return (
    <footer className="mx-auto max-w-[1440px] px-5 md:px-12 lg:px-[72px]">
      <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--ink)] py-6">
        <span className="ff-display text-[20px] text-[var(--ink)]">Jellyhook</span>
        <span className="flex flex-wrap gap-6">
          {FOOTER_LINKS.map((item) => (
            <Link key={item.label} href={item.href} className="ff-body text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--ink)] transition-colors hover:text-[var(--lime)]">
              {item.label}
            </Link>
          ))}
        </span>
      </div>
    </footer>
  );
}
