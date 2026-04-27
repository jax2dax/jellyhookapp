// lib/actions/site-cookie.js
// Server actions to read/write the preferred_site_id cookie.
// This is the single source of truth for "which site the user is viewing."
// Called after site creation, site switching, or site deletion.

"use server";
import { cookies } from "next/headers";

const COOKIE_NAME = "preferred_site_id";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 365, // 1 year
};

// ─────────────────────────────────────────────────────────────────────────────
// getPreferredSiteId — reads the cookie, returns string | null
// ─────────────────────────────────────────────────────────────────────────────
export async function getPreferredSiteId() {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// setPreferredSiteId — writes the cookie
// Call this after: site creation, site switching, site deletion (with next site id)
// ─────────────────────────────────────────────────────────────────────────────
export async function setPreferredSiteId(siteId) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, siteId, COOKIE_OPTIONS);
}

// ─────────────────────────────────────────────────────────────────────────────
// clearPreferredSiteId — clears the cookie
// Call this when user has no sites left (after last site soft-deleted)
// ─────────────────────────────────────────────────────────────────────────────
export async function clearPreferredSiteId() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}