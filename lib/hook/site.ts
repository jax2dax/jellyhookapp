// lib/hook/site.ts
// Shared by every Hook server action (hook.action.ts, canvas.action.ts):
// which site a request may read, and how a failure is reported. Server only,
// and NOT a server action itself (no "use server"), so it can't be called
// from the browser directly.
import "server-only";
import { auth } from "@clerk/nextjs/server";
import { getUserSite } from "@/lib/actions/permission.actions";
import { HookError, isHookError } from "@/jh-hook/errors";
import { hookLog, refCode } from "@/jh-hook/debug";

const DEV = process.env.NODE_ENV !== "production";

/**
 * The site a hook runs against: exactly the site every /platform page shows
 * (getUserSite: the preferred-site cookie if the user is an active member
 * of it, otherwise their most recent site). getUserSite only ever returns a
 * site the user is an active member of, so this is also the access check.
 */
export async function siteOrThrow(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new HookError("You're signed out. Sign in again to run hooks.");
  const site = (await getUserSite(userId)) as { id?: string; __pendingInvite?: boolean } | null;
  if (!site || site.__pendingInvite || !site.id) throw new HookError("No site is available. Create a site or accept your invite first.");
  return site.id;
}

export type Failure = { ok: false; error: string; ref?: string };

/**
 * A HookError goes back verbatim (it says what to fix). Anything else is
 * logged with a reference code; the person gets the code, never the raw
 * message (it can carry SQL or connection details), except in development.
 */
export function failure(e: unknown, context: { what: string; siteId?: string; t0?: number }): Failure {
  if (isHookError(e)) {
    hookLog.info(`${context.what} refused`, { site: context.siteId?.slice(0, 8), message: e.message });
    return { ok: false, error: e.message };
  }
  const ref = refCode();
  hookLog.error(`${context.what} failed`, {
    ref,
    site: context.siteId?.slice(0, 8),
    ms: context.t0 ? Date.now() - context.t0 : undefined,
    error: e instanceof Error ? e.message : String(e),
  });
  const detail = DEV && e instanceof Error ? ` (development only: ${e.message})` : "";
  return { ok: false, ref, error: `Something went wrong on our side. Reference ${ref}.${detail}` };
}
