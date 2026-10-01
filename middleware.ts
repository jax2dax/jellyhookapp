import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

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
export const config = {
  matcher: [
    // Skip Next.js internals, all static files (unless found in search params),
    // and the public tracker-facing API routes.
    '/((?!_next|api/track$|api/track-form$|api/track-form-engagement$|api/track-structure$|api/site-config$|api/close-stale-sessions$|api/webhooks/clerk$|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
};