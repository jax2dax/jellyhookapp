// app/sign-in/sso-callback/page.tsx
// Where Google lands back after SignInCard's signIn.sso(). Mirrors app/sign-up/sso-callback exactly: see that file's
// comment for why both destinations are set.
"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { AFTER_AUTH_URL } from "@/components/auth/redirects";

export default function Page() {
  return <AuthenticateWithRedirectCallback signInFallbackRedirectUrl={AFTER_AUTH_URL} signUpFallbackRedirectUrl={AFTER_AUTH_URL} />;
}
