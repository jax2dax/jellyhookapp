// components/marketing/MarketingPage.tsx
// Shared shell for the public marketing pages (/pricing, /about, /terms, /privacy, /demo, /docs, sign-in): fonts, the
// magazine theme (MarketingTheme.tsx, same look as the home page), masthead header and footer. A plain server
// component; SiteHeader carries its own "use client" for the mobile menu.
import * as React from "react";
import Script from "next/script";
import { marketingFontVariables, v2FontVariables } from "./fonts";
import { MarketingThemeStyles } from "./MarketingTheme";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

export function MarketingPage({ children }: { children: React.ReactNode }) {
  return (
    <div className={`jh-mkt ${marketingFontVariables} ${v2FontVariables} ff-body min-h-screen overflow-x-clip bg-[var(--paper)] text-[var(--ink)] antialiased`}>
      <MarketingThemeStyles />
      <SiteHeader />
      <main className="pt-[88px] md:pt-[100px]">{children}</main>
      <SiteFooter />
      {/* Jellyhook tracking its own public pages (landing, docs, demo, pricing). Kept here, not in the root layout, so
          visits inside /platform are not recorded as marketing-site traffic. */}
      <Script src="https://jellyhook.com/tracker.js" data-key="0b4ba5bf-b233-48d2-ad22-4fcbef07018c" strategy="afterInteractive" />
    </div>
  );
}
