// app/docs/ui.tsx
// Small building blocks shared by the longer docs pages (Hook, Preview, Results), so they all
// look the same and a page reads as content, not as styling. The older pages keep their inline
// classes; both produce the same look.
import type { ReactNode } from "react";
import { DOCS_REVIEWED } from "./docsSync";

export function DocHeader({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: ReactNode }) {
  return (
    <>
      <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">{eyebrow}</span>
      <h1 className="mt-3 ff-display text-3xl text-[#f4f2ea]">{title}</h1>
      {intro && <p className="mt-5 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">{intro}</p>}
    </>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="mb-3 ff-display text-xl text-[#f4f2ea]">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-6 mb-1 ff-mono text-[11px] uppercase tracking-[0.2em] text-[var(--lime)]">{children}</h3>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="max-w-2xl list-disc space-y-1.5 pl-5 ff-body text-[14px] leading-relaxed text-[#8b8980]">{children}</ul>;
}

export function OL({ children }: { children: ReactNode }) {
  return <ol className="max-w-2xl list-decimal space-y-1.5 pl-5 ff-body text-[14px] leading-relaxed text-[#8b8980]">{children}</ol>;
}

/** A UI label exactly as it appears on screen. */
export function B({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-[#c9c7bd]">{children}</strong>;
}

export function C({ children }: { children: ReactNode }) {
  return <code className="ff-mono text-[#c9c7bd]">{children}</code>;
}

export function Callout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="max-w-2xl border border-[#1b1b18] border-l-[var(--lime)] bg-[#0a0a09] p-4" style={{ borderLeftWidth: 2 }}>
      <div className="ff-mono text-[11px] uppercase tracking-[0.2em] text-[var(--lime)]">{title}</div>
      <div className="mt-2 space-y-2 ff-body text-[13px] leading-relaxed text-[#8b8980]">{children}</div>
    </div>
  );
}

export function Example({ title, build, why }: { title: string; build: ReactNode; why?: ReactNode }) {
  return (
    <div className="max-w-2xl border border-[#1b1b18] bg-[#0a0a09] p-4">
      <div className="ff-body text-[14px] font-medium text-[#f4f2ea]">{title}</div>
      <div className="mt-2 ff-body text-[13px] leading-relaxed text-[#8b8980]">{build}</div>
      {why && <div className="mt-2 ff-body text-[13px] leading-relaxed text-[#77756d]">Why it is useful: {why}</div>}
    </div>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto border border-[#1b1b18]">
      <table className="w-full min-w-[480px] text-left ff-body text-[13px]">
        <thead>
          <tr className="border-b border-[#1b1b18] bg-[#0a0a09]">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 ff-mono text-[11px] font-normal uppercase tracking-[0.15em] text-[#77756d]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1b1b18]">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-2 align-top leading-relaxed ${j === 0 ? "text-[#c9c7bd]" : "text-[#8b8980]"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Shown at the bottom of Hook, Preview and Results pages: which version of the feature this describes. */
export function DocFooter({ feature }: { feature: "hook" | "preview" | "results" }) {
  const what = feature === "hook" ? `Hook (query format version ${DOCS_REVIEWED.hookSpecVersion})` : feature === "preview" ? "the Hook preview" : "the Hook results canvas";
  return (
    <div className="mt-16 border-t border-[#1b1b18] pt-4 ff-mono text-[11px] text-[#5f5d57]">
      This page describes {what} as reviewed on {DOCS_REVIEWED.reviewedOn}.
    </div>
  );
}
