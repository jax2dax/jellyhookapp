// app/landing-preview/Shot.tsx
//
// A screenshot slot on the landing page. Drop the image into public/landing/<file> and it appears; nothing else to edit.
//   - file exists            -> the screenshot, framed and tagged "Sample data"
//   - missing, in development -> a visible placeholder that says which file to add and what to capture
//   - missing, in production  -> the fallback (the coded panel that was there before), so the live page never shows a hole
// Server component: it checks the file on disk at render time.
import fs from "node:fs";
import path from "node:path";
import Image from "next/image";

const LABEL = "ff-mono text-[11px] uppercase tracking-[0.2em] text-[#8b8980]";
const TAG = "border border-[#5f5d57] bg-[#0f0f0d] px-2 py-0.5 ff-mono text-[11px] uppercase tracking-[0.2em] text-[#8b8980]";

export function Shot({
  file,
  title,
  alt,
  capture,
  width = 1600,
  height = 1000,
  fallback = null,
}: {
  /** file name inside public/landing/, e.g. "lead-page.png" */
  file: string;
  /** frame title, e.g. "Lead page" */
  title: string;
  /** what the image shows, for screen readers */
  alt: string;
  /** shown on the development placeholder: what to screenshot */
  capture: string;
  width?: number;
  height?: number;
  fallback?: React.ReactNode;
}) {
  const exists = fs.existsSync(path.join(process.cwd(), "public", "landing", file));

  if (!exists) {
    if (process.env.NODE_ENV === "production") return <>{fallback}</>;
    return (
      <div className="space-y-3">
        <div className="flex min-h-48 flex-col justify-center gap-2 border-2 border-dashed border-[#5f5d57] bg-[#0a0a09] p-6">
          <span className={LABEL}>Screenshot placeholder (dev only)</span>
          <p className="ff-body text-[14px] leading-[1.55] text-[#e9e7e0]">
            Add <code className="ff-mono text-[var(--lime)]">public/landing/{file}</code> ({width}×{height} or the same ratio).
          </p>
          <p className="ff-body text-[14px] leading-[1.55] text-[#9d9b92]">Capture: {capture}</p>
        </div>
        {fallback}
      </div>
    );
  }

  return (
    <figure className="border border-[#1b1b18] bg-[#0a0a09]">
      <div className="flex items-center justify-between gap-3 border-b border-[#1b1b18] px-4 py-3">
        <span className={LABEL}>{title}</span>
        <span className={TAG}>Sample data</span>
      </div>
      <Image src={`/landing/${file}`} alt={alt} width={width} height={height} className="h-auto w-full" sizes="(min-width: 1024px) 680px, 100vw" />
    </figure>
  );
}
