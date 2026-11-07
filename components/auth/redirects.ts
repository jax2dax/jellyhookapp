// components/auth/redirects.ts
// Where a person goes after signing in or signing up, and where a signed-in person is sent if they open /sign-in or
// /sign-up again. One value for every path: the email + password forms, Google (signIn.sso / signUp.sso), the two
// sso-callback pages and middleware.ts. /platform/dashboard sends a new account with no site on to adding one.
export const AFTER_AUTH_URL = "/platform/dashboard";

// Clerk's error when a session already exists in this browser (another tab, or the person came back to the form).
export function isAlreadySignedInError(err: { message?: string; code?: string } | null | undefined) {
  if (!err) return false;
  return /already signed in|session_exists/i.test(`${err.message ?? ""} ${err.code ?? ""}`);
}
