// app/sign-up/sso-callback/page.tsx
// Where Google lands back after SignUpCard's authenticateWithRedirect.
// AuthenticateWithRedirectCallback finishes the OAuth handshake with Clerk
// and then sends the browser on to signUpFallbackRedirectUrl itself — no
// custom logic needed here, and nothing Clerk-hosted is ever shown, it's
// just a blank beat while the redirect resolves.
"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function Page() {
  return <AuthenticateWithRedirectCallback />;
}
