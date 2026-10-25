// lib/actions/formFields.action.ts
// The site's form fields (lib/forms/catalog.ts) for the mark builder, Enter with AI and Settings → Form fields, and
// naming a field ("field_3" -> "Budget"). Any active member of the site can name a field. Never reads or returns a
// lead's answers: only how often a field was answered and what kind of value it holds.
// Design: mds/build/marks/marks-v2-plan.md. Table: mds/migrations/21-form-field-names.sql.
"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { siteOrThrow } from "@/lib/hook/site";
import { isHookError } from "@/jh-hook/errors";
import { buildCatalog, type CatalogField } from "@/lib/forms/catalog";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
class FieldsError extends Error {}

const REPORTS = 400; // recent form views read for the field lists (the first per form wins)
const SAMPLE = 300; // recent leads sampled for "answered" and number detection

async function who(): Promise<{ userId: string; siteId: string }> {
  const { userId } = await auth();
  if (!userId) throw new FieldsError("You're signed out. Sign in again.");
  const siteId = await siteOrThrow();
  const { data } = await admin.from("site_members").select("user_id").eq("site_id", siteId).eq("user_id", userId).eq("status", "active").maybeSingle();
  if (!data) throw new FieldsError("You are not a member of this site.");
  return { userId, siteId };
}

const fail = (e: unknown, what: string) => {
  if (e instanceof FieldsError || isHookError(e)) return { ok: false as const, error: (e as Error).message };
  console.error("[formFields] " + what + " failed", e instanceof Error ? e.message : String(e));
  return { ok: false as const, error: "That did not work. Try again." };
};

/** The site's form fields, most answered first. `namesReady` is false until migration 21 has run (names cannot be saved). */
export async function loadFormFields(): Promise<Result<{ fields: CatalogField[]; namesReady: boolean }>> {
  try {
    const { siteId } = await who();
    const [reportsRes, namesRes, answersRes] = await Promise.all([
      admin.from("form_engagement").select("form_key, page_path, form_fields").eq("site_id", siteId).not("form_fields", "is", null).order("viewed_at", { ascending: false }).limit(REPORTS),
      admin.from("form_field_names").select("field_key, name").eq("site_id", siteId),
      admin.from("form_submissions").select("raw_data").eq("site_id", siteId).order("submitted_at", { ascending: false }).limit(SAMPLE),
    ]);
    if (reportsRes.error) throw new Error(reportsRes.error.message);
    if (answersRes.error) throw new Error(answersRes.error.message);
    const namesReady = !namesRes.error;
    const fields = buildCatalog(
      reportsRes.data ?? [],
      namesReady ? (namesRes.data ?? []) : [],
      (answersRes.data ?? []).map((r) => (r.raw_data && typeof r.raw_data === "object" ? (r.raw_data as Record<string, unknown>) : {})),
    );
    return { ok: true, fields, namesReady };
  } catch (e) {
    return fail(e, "load");
  }
}

/** Names a field (or clears its name with an empty string). */
export async function nameFormField(fieldKey: string, name: string): Promise<Result> {
  try {
    const { userId, siteId } = await who();
    const key = String(fieldKey ?? "").slice(0, 107);
    if (!key) return { ok: false, error: "Pick a field." };
    const clean = String(name ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
    const { error } = clean
      ? await admin.from("form_field_names").upsert({ site_id: siteId, field_key: key, name: clean, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: "site_id,field_key" })
      : await admin.from("form_field_names").delete().eq("site_id", siteId).eq("field_key", key);
    if (error) {
      if (/form_field_names/.test(error.message) && /does not exist|schema cache/.test(error.message)) return { ok: false, error: "Field names are not set up on this database yet (migration 21)." };
      throw new Error(error.message);
    }
    return { ok: true };
  } catch (e) {
    return fail(e, "name");
  }
}
