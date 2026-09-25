// components/marketing/MarketingPage.tsx
// Shared shell for every public marketing page: fonts, lime theme, grain
// texture, header, footer. A plain server component — none of this needs
// client-side state (SiteHeader carries its own "use client" for the mobile
// menu toggle).
import * as React from "react";
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
    </div>
  );
}
