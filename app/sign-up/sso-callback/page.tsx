// app/sign-up/sso-callback/page.tsx
// Where Google lands back after SignUpCard's signUp.sso(). AuthenticateWithRedirectCallback finishes the OAuth
// handshake with Clerk and then sends the browser on. The destination is set here, not left to Clerk's defaults: a
// Google sign-up can turn into a sign-in (the account already exists) and the reverse, and with no value Clerk falls
// back to "/", the landing page. Both go to the app (components/auth/redirects.ts).
"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { AFTER_AUTH_URL } from "@/components/auth/redirects";

export default function Page() {
  return <AuthenticateWithRedirectCallback signInFallbackRedirectUrl={AFTER_AUTH_URL} signUpFallbackRedirectUrl={AFTER_AUTH_URL} />;
}
