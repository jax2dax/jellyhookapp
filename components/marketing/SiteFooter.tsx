// components/marketing/SiteFooter.tsx
// Shared footer for every public marketing page — real routes now (was
// three "Privacy"/"Terms"/"Docs" links all pointing at "#").
import Link from "next/link";
import Image from "next/image";

const FOOTER_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Docs", href: "/docs" },
];

export function SiteFooter() {
  return (
    <footer className="px-5 lg:px-10">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Image src="/jellyhookMark.png" alt="Jellyhook" width={20} height={20} className="h-5 w-5 object-contain" />
          <span className="ff-mono text-[10px] uppercase tracking-[0.28em] text-[var(--lime)]">Jellyhook</span>
          <span className="ff-mono text-[10px] uppercase tracking-[0.28em] text-[#4a4a43]">© 2026</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          {FOOTER_LINKS.map((item) => (
            <Link key={item.label} href={item.href} className="ff-mono text-[10px] uppercase tracking-[0.24em] text-[#77756d] transition-colors hover:text-[var(--lime)]">
              {item.label}
            </Link>
          ))}
          <span className="flex items-center gap-2 ff-mono text-[10px] uppercase tracking-[0.24em] text-[#5f5d57]">
            <span className="h-1.5 w-1.5 animate-pulse bg-[var(--lime)]" />
            All systems go
          </span>
        </div>
      </div>
    </footer>
  );
}
