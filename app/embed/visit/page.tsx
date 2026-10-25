// app/embed/visit/page.tsx
// The visit chart opened from the Jellyhook card on a HubSpot contact ("Open visit chart", in HubSpot's own modal).
// No Jellyhook sign-in: the 30-minute token from the card (lib/integrations/hubspot.ts makeChartToken) names one site
// and one visitor, and this page shows that visitor's visits exactly as the lead page does, read-only. Loaded on the
// server with the service role; the form's answers, name and email are never read here. Only HubSpot may frame it
// (next.config.ts, frame-ancestors). Design: mds/build/integrations/hubspot.md.
import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { readChartToken } from "@/lib/integrations/hubspot";
import { fetchStructureRows } from "@/lib/leadSessions/structureRows";
import { EmbedVisit } from "@/components/leads/EmbedVisit";

export const metadata: Metadata = { title: "Visit chart", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://jellyhook.com").replace(/\/+$/, "");

function Message({ text }: { text: string }) {
  return <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center text-sm text-muted-foreground">{text}</div>;
}

export default async function EmbedVisitPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = (await searchParams) ?? {};
  const token = readChartToken(typeof sp.t === "string" ? sp.t : null);
  if (!token) return <Message text="This chart link has expired. Close this window and open the chart again from the Jellyhook card." />;

  const [sessions, pageViews, submissions, forms, site] = await Promise.all([
    admin.from("sessions").select("*").eq("site_id", token.s).eq("visitor_id", token.v).order("started_at", { ascending: true }),
    admin.from("page_views").select("*").eq("site_id", token.s).eq("visitor_id", token.v).order("entered_at", { ascending: true }),
    admin.from("form_submissions").select("id, session_id, page_path, submitted_at").eq("site_id", token.s).eq("visitor_id", token.v).order("submitted_at", { ascending: true }),
    admin.from("form_engagement").select("*").eq("site_id", token.s).eq("visitor_id", token.v),
    admin.from("sites").select("domain").eq("id", token.s).maybeSingle(),
  ]);
  if (sessions.error || pageViews.error) return <Message text="Jellyhook could not load this visit. Try again in a moment." />;
  const paths = [...new Set((pageViews.data ?? []).map((v) => v.page_path as string).filter(Boolean))];
  const structure = await fetchStructureRows(admin, token.s, paths);
  const lead = (submissions.data ?? []).find((s) => s.id === token.l) ?? null;

  return (
    <EmbedVisit
      siteId={token.s}
      visitorId={token.v}
      domain={(site.data?.domain as string) ?? null}
      sentAt={(lead?.submitted_at as string) ?? null}
      jellyhookUrl={APP_URL + "/platform/leads/" + token.l}
      sessions={sessions.data ?? []}
      pageViews={pageViews.data ?? []}
      submissions={submissions.data ?? []}
      structure={structure}
      forms={forms.data ?? []}
    />
  );
}
