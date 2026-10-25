"use client";
// components/notifications/SlackPreview.tsx
// A close look-alike of how Slack shows a hooked-lead message, drawn from the exact blocks Jellyhook sends
// (lib/notifications/message.ts slackMessage), so the hook editor's options can be checked before saving. "Send a test
// to Slack" (in the editor) shows the real thing.
import * as React from "react";

type Block = {
  type: string;
  text?: { type: string; text: string };
  image_url?: string;
  title?: { text: string };
  alt_text?: string;
  elements?: { type: string; text?: string | { text: string }; url?: string; style?: string }[];
};

/** Slack mrkdwn, the parts these messages use: *bold* and <!date^...|fallback>. */
function Mrkdwn({ text }: { text: string }) {
  const clean = text.replace(/<!date\^\d+\^[^|]*\|([^>]*)>/g, (_m, fallback: string) => {
    const d = new Date(fallback);
    return Number.isNaN(d.getTime()) ? fallback : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  });
  // Slack shows escaped text (&lt; &gt; &amp;) as the characters themselves
  const unescape = (t: string) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  return (
    <>
      {clean.split(/(\*[^*]+\*)/g).map((part, i) =>
        part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
          <strong key={i} className="font-semibold">
            {unescape(part.slice(1, -1))}
          </strong>
        ) : (
          <React.Fragment key={i}>{unescape(part)}</React.Fragment>
        ),
      )}
    </>
  );
}

export function SlackPreview({ blocks }: { blocks: Block[] }) {
  return (
    <div className="rounded-lg border bg-white p-3 font-[Lato,ui-sans-serif,system-ui] text-[15px] leading-snug text-[#1d1c1d] shadow-sm dark:bg-[#1a1d21] dark:text-[#d1d2d3]">
      <div className="flex gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/jellyhook-nobg.png" alt="" className="size-9 shrink-0 rounded-md bg-black/5 object-contain p-1" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold">Jellyhook</span>
            <span className="rounded bg-black/10 px-1 text-[10px] font-semibold uppercase text-black/60 dark:bg-white/10 dark:text-white/60">App</span>
            <span className="text-xs text-black/50 dark:text-white/50">now</span>
          </div>
          {blocks.map((b, i) => {
            if (b.type === "header") return <div key={i} className="text-[17px] font-bold">{b.text?.text}</div>;
            if (b.type === "section") return <div key={i} className="whitespace-pre-line"><Mrkdwn text={b.text?.text ?? ""} /></div>;
            if (b.type === "image")
              return (
                <div key={i} className="space-y-1">
                  {b.title?.text && <div className="text-xs text-black/60 dark:text-white/60">{b.title.text}</div>}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.image_url} alt={b.alt_text ?? ""} className="max-h-56 max-w-sm rounded-md border border-black/10 object-cover dark:border-white/10" />
                </div>
              );
            if (b.type === "context")
              return (
                <div key={i} className="text-xs text-black/55 dark:text-white/55">
                  {(b.elements ?? []).map((e, j) => (
                    <Mrkdwn key={j} text={typeof e.text === "string" ? e.text : (e.text?.text ?? "")} />
                  ))}
                </div>
              );
            if (b.type === "actions")
              return (
                <div key={i} className="flex flex-wrap gap-2 pt-0.5">
                  {(b.elements ?? []).map((e, j) => (
                    <span key={j} className={"rounded border px-3 py-1 text-[13px] font-bold " + (e.style === "primary" ? "border-[#007a5a] bg-[#007a5a] text-white" : "border-black/25 text-[#1d1c1d] dark:border-white/25 dark:text-[#d1d2d3]")}>
                      {typeof e.text === "string" ? e.text : e.text?.text}
                    </span>
                  ))}
                </div>
              );
            return null;
          })}
        </div>
      </div>
    </div>
  );
}
