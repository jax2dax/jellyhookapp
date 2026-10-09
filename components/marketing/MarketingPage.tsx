// components/marketing/MarketingPage.tsx
// Shared shell for every public marketing page: fonts, lime theme, grain
// texture, header, footer. A plain server component — none of this needs
// client-side state (SiteHeader carries its own "use client" for the mobile
// menu toggle).
import * as React from "react";
import Script from "next/script";
import { marketingFontVariables } from "./fonts";
import { MarketingThemeStyles, GrainOverlay } from "./MarketingTheme";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

export function MarketingPage({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${marketingFontVariables} ff-body min-h-screen overflow-x-hidden bg-[#070706] text-[#e9e7e0] antialiased selection:bg-[var(--lime)] selection:text-black`}
    >
      <MarketingThemeStyles />
      <GrainOverlay />
      <SiteHeader />
      <main className="pt-16 md:pt-[72px]">{children}</main>
      <SiteFooter />
      {/* Jellyhook tracking its own public pages (landing, docs, demo, pricing). Kept here, not in the root layout, so
          visits inside /platform are not recorded as marketing-site traffic. */}
      <Script src="https://jellyhook.com/tracker.js" data-key="0b4ba5bf-b233-48d2-ad22-4fcbef07018c" strategy="afterInteractive" />
    </div>
  );
}
