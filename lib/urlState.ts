// lib/urlState.ts
// Page state that belongs in the address bar: search text, filters, date
// ranges, selected tabs. Why: a refresh, the back button and a shared link
// all keep the exact view; and a page's state is something a person (or a
// support agent) can read and copy.
//
// Rules this hook enforces, so every page behaves the same:
//   - only NON-default values are written, so the plain page keeps a clean URL;
//   - changes use router.replace (no history entry per keystroke) and never
//     scroll the page;
//   - unknown params are left alone (other features may own them);
//   - values are always strings here; the page parses them (see parse helpers).
// Used by: /platform/leads, /platform/conversions (ConvertedLeadsExplorer and
// the chart section), /platform/leads/[lead_id] (selected session). See
// mds/documentation/url-state.md for every key.
"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useUrlState<T extends Record<string, string>>(defaults: T): [T, (patch: Partial<T>) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // the defaults are fixed for the life of the page (a stable copy, safe to read during render)
  const [defs] = React.useState(defaults);

  const state = React.useMemo(() => {
    const out: Record<string, string> = {};
    for (const key of Object.keys(defs)) out[key] = params.get(key) ?? defs[key];
    return out as T;
  }, [params, defs]);

  const set = React.useCallback(
    (patch: Partial<T>) => {
      // read the freshest URL, not a stale render's: two quick changes must both stick
      const next = new URLSearchParams(typeof window !== "undefined" ? window.location.search : params.toString());
      for (const [key, value] of Object.entries(patch)) {
        const def = defs[key];
        if (value === undefined || value === "" || value === def) next.delete(key);
        else next.set(key, String(value));
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router, defs],
  );

  return [state, set];
}

/** A text box value that updates the URL after a pause, so typing doesn't write the address bar per keystroke. */
export function useDebouncedUrlText(value: string, commit: (v: string) => void, ms = 300): [string, (v: string) => void] {
  const [text, setText] = React.useState(value);
  const [prev, setPrev] = React.useState(value);
  if (value !== prev) {
    // the URL changed from elsewhere (back button): follow it
    setPrev(value);
    setText(value);
  }
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const change = (v: string) => {
    setText(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(v), ms);
  };
  return [text, change];
}

/** One of a fixed set of values, else the fallback (a tampered URL must not break a page). */
export function oneOf<V extends string>(value: string, allowed: readonly V[], fallback: V): V {
  return (allowed as readonly string[]).includes(value) ? (value as V) : fallback;
}
