"use client";
// components/admin/CopyReport.tsx
// A button at the end of a control room page that copies everything the page shows, as text, to the clipboard, so the founder
// can paste it instead of selecting the whole screen. Reads the visible text of the element with the given id when clicked
// (so it is the numbers as they are now, with Live on or off).
import { useState } from "react";

export function CopyReport({ targetId }: { targetId: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  async function copy() {
    const el = document.getElementById(targetId);
    const text = (el?.innerText ?? "").replace(/\n{3,}/g, "\n\n").trim();
    const stamp = `Control room copied ${new Date().toLocaleString()} from ${location.pathname}${location.search}\n\n`;
    try {
      await navigator.clipboard.writeText(stamp + text);
      setState("done");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2500);
  }

  return (
    <div className="flex items-center gap-3 border-t pt-4">
      <button type="button" onClick={copy} className="h-8 rounded-md border px-3 text-sm hover:bg-muted">
        Copy everything on this page
      </button>
      <span className="text-xs text-muted-foreground" role="status">
        {state === "done" ? "Copied. Paste it to Claude." : state === "failed" ? "The browser refused. Select the page and copy by hand." : ""}
      </span>
    </div>
  );
}
