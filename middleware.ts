import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { AFTER_AUTH_URL } from '@/components/auth/redirects';

// A signed-in person who opens /sign-in or /sign-up (for example "Try it free" on the landing page) goes straight to
// the app, like most SaaS products. Without this the form showed Clerk's "You're already signed in" error and there
// was no way into /platform except typing the address. The Google callback pages are left alone: they run while the
// session is being created and send the person on themselves.
const isAuthPage = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);
const isSsoCallback = createRouteMatcher(['/sign-in/sso-callback(.*)', '/sign-up/sso-callback(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isAuthPage(req) && !isSsoCallback(req)) {
    const { userId } = await auth();
    if (userId) return NextResponse.redirect(new URL(AFTER_AUTH_URL, req.url));
  }
});

// The tracker-facing API routes below are hit by anonymous visitors on
// CUSTOMERS' websites — cross-origin, no Clerk session, ever, by design
// (authorization happens via an api_key check inside each route, not
// Clerk). Clerk's middleware performs a "handshake" redirect to itself to
// verify/refresh session cookie state on requests it sees, which browsers
// refuse to follow during a CORS preflight (breaks every POST route
// outright) and which can also just land somewhere without the right CORS
// headers for a followed GET redirect. These routes must never be touched
// by Clerk's middleware at all — excluded explicitly, not just left out of
// the matcher's broad catch-all, so adding a new "/(api|trpc)(.*)" style
// pattern later can't silently re-include them.
// (The same for the Jellyhook card's data, called by HubSpot's servers and authorized by HubSpot's signature,
// lib/integrations/hubspot.ts. The visit chart in HubSpot's modal, /embed/visit, stays under Clerk: it renders the
// root layout's ClerkProvider, and a frame without Jellyhook cookies is simply signed out.)
export const config = {
  matcher: [
    // Skip Next.js internals, all static files (unless found in search params),
    // and the public tracker-facing API routes.
    '/((?!_next|api/track$|api/track-form$|api/track-form-engagement$|api/track-structure$|api/site-config$|api/close-stale-sessions$|api/webhooks/clerk$|api/hubspot/card$|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
};