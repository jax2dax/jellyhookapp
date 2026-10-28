import type { Metadata } from "next";
import { SignUpCard } from "@/components/auth/SignUpCard";
import { MarketingThemeStyles } from "@/components/marketing/MarketingTheme";
import { marketingFontVariables, v2FontVariables } from "@/components/marketing/fonts";

export const metadata: Metadata = {
  title: "Sign up",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <div className={`jh-mkt ${marketingFontVariables} ${v2FontVariables} ff-body min-h-screen bg-[var(--paper-2)] text-[var(--ink)]`}>
      <MarketingThemeStyles />
      <main className="flex min-h-screen items-center justify-center px-4 py-20">
        <SignUpCard />
      </main>
    </div>
  );
}
