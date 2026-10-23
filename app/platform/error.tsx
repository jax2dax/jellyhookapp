"use client";
// app/platform/error.tsx
// Shown when a platform page fails to load (for example the database did not answer), instead of a blank page or a
// misleading "No sites yet". Retry re-renders the page.
import * as React from "react";

export default function PlatformError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
        <h1 className="text-base font-semibold text-foreground">This page could not load</h1>
        <p className="mt-2 text-sm text-muted-foreground">The database did not respond in time. Your data is safe. Try again in a moment.</p>
        {error.digest && <p className="mt-2 font-mono text-[11px] text-muted-foreground">Ref: {error.digest}</p>}
        <button type="button" onClick={reset} className="mt-4 h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          Try again
        </button>
      </div>
    </div>
  );
}
