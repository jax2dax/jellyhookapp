import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { SignInCard } from "@/components/auth/SignInCard";
import { MarketingThemeStyles } from "@/components/marketing/MarketingTheme";
import { marketingFontVariables } from "@/components/marketing/fonts";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function Page() {
  // Already signed in: there is nothing to sign in to, so go straight to the dashboard (no form, no error).
  // SignInCard keeps its own client-side redirect for a session that appears after this page has loaded.
  const { userId } = await auth();
  if (userId) redirect("/platform/dashboard");

  return (
    <div className={`${marketingFontVariables} ff-body min-h-screen bg-[#070706]`}>
      <MarketingThemeStyles />
      <main className="flex min-h-screen items-center justify-center px-4 py-20">
        <SignInCard />
      </main>
    </div>
  );
}
