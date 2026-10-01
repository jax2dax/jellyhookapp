// app/sign-in/sso-callback/page.tsx
// Where Google lands back after SignInCard's signIn.sso(). Mirrors
// app/sign-up/sso-callback exactly — see that file's comment.
"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function Page() {
  return <AuthenticateWithRedirectCallback />;
}
