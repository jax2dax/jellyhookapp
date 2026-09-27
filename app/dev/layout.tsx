// app/dev/layout.tsx
// Everything under /dev is an internal demo/playground (see
// app/dev/frame-plate/page.jsx), not part of the public site. The page
// itself is a client component so it can't export metadata directly; this
// layout covers the whole subtree instead.
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return children;
}
