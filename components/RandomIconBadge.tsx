// components/RandomIconBadge.tsx
//
// A small decorative icon that picks ONE random image out of a provided set
// every time the page loads. Source images can be any size (the Halloween
// set is 512x512) — this always renders them down at `size`, so callers
// never need to pre-resize assets to use them here.
//
// Rendered client-only via next/dynamic(..., { ssr: false }): the whole
// point is a per-load random pick, which would disagree between the
// server-rendered HTML and the client's first paint if this ran during SSR
// (a lazy useState initializer runs independently on each side) — ssr:false
// skips server rendering entirely instead of fighting that mismatch. The
// dynamic() call has to live in a "use client" module (Next disallows
// ssr:false from Server Components), but the exported result is a normal
// component any Server Component page can import and render.
"use client";

import * as React from "react";
import Image from "next/image";
import dynamicImport from "next/dynamic";

export interface RandomIconBadgeProps {
  /** candidate image paths (e.g. public/haloween/*.png) — one is picked at random per mount */
  images: string[];
  /** rendered size in px, both width and height (square) — defaults to a small icon, regardless of source resolution */
  size?: number;
  className?: string;
}

function RandomIconBadgeInner({ images, size = 40, className }: RandomIconBadgeProps) {
  // Math.random() belongs in a useState lazy initializer, not the render
  // body directly — this runs exactly once per mount (not on every
  // re-render), which is the whole point: a stable pick for the component's
  // lifetime instead of reshuffling on unrelated parent re-renders.
  const [src] = React.useState<string | null>(() => (images.length ? images[Math.floor(Math.random() * images.length)] : null));
  if (!src) return null;
  return (
    <Image
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={className ?? "select-none object-contain"}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}

export const RandomIconBadge = dynamicImport(() => Promise.resolve(RandomIconBadgeInner), { ssr: false });
