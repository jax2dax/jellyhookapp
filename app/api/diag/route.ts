// app/api/diag/route.ts
// TEMPORARY production diagnostic (delete after use). Tells you, for each environment variable the app
// needs, whether it is present and whether it has a character that breaks HTTP headers (the cause of
// "Invalid header name or value: Authorization: Bearer ..."), and runs one real query with each Supabase
// key so the exact error shows. Never prints a secret value. Only the Clerk user ids in
// DEV_USAGE_USER_IDS may open it; anyone else gets a 404.
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const NAMES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "CLERK_WEBHOOK_SIGNING_SECRET",
  "NEXT_PUBLIC_TRACKER_URL",
  "IP_HASH_SALT",
  "HOOK_DATABASE_URL",
];

function inspect(v: string | undefined) {
  if (v === undefined) return { present: false };
  const nonAscii = [...v].some((c) => c.charCodeAt(0) > 126 || c.charCodeAt(0) < 33);
  return {
    present: true,
    length: v.length,
    startsWith: v.slice(0, 6),
    hasNonAsciiOrSpace: nonAscii,
    hasQuotes: /["']/.test(v),
  };
}

export async function GET() {
  const { userId } = await auth();
  const allowed = (process.env.DEV_USAGE_USER_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!userId || !allowed.includes(userId)) return new NextResponse("Not found", { status: 404 });

  const env: Record<string, unknown> = {};
  for (const n of NAMES) env[n] = inspect(process.env[n]);

  async function tryQuery(label: string, key: string | undefined, token?: string | null) {
    try {
      const sb = createClient(process.env.SUPABASE_URL!, key!, token ? { accessToken: async () => token } : undefined);
      const { error, data } = await sb.from("sites").select("id").limit(1);
      return { label, ok: !error, error: error ? `${error.code ?? ""} ${error.message}` : null, rows: data?.length ?? 0 };
    } catch (e) {
      return { label, ok: false, error: e instanceof Error ? e.message : String(e), rows: 0 };
    }
  }

  const a = await auth();
  const token = await a.getToken();
  const tests = [
    await tryQuery("service role key", process.env.SUPABASE_SERVICE_ROLE_KEY),
    await tryQuery("anon key (no login)", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    await tryQuery("anon key + your Clerk login token", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, token),
  ];

  return NextResponse.json({ userId, clerkTokenPresent: !!token, env, tests }, { status: 200 });
}
