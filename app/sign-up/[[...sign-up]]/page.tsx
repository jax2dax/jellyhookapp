import type { Metadata } from "next";
import { SignUpCard } from "@/components/auth/SignUpCard";
import { MarketingThemeStyles } from "@/components/marketing/MarketingTheme";
import { marketingFontVariables } from "@/components/marketing/fonts";

export const metadata: Metadata = {
  title: "Sign up",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <div className={`${marketingFontVariables} ff-body min-h-screen bg-[#070706]`}>
      <MarketingThemeStyles />
      <main className="flex min-h-screen items-center justify-center px-4 py-20">
        <SignUpCard />
      </main>
    </div>
  );
}
