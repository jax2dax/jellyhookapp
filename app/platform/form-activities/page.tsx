// app/platform/form-activities/page.tsx
// Form activities: every form on the site that someone started, converted or not, newest first. A person who
// submitted shows their name; anyone else is an anonymous visitor. Each row opens the full drawing of that form
// (components/forms/FormActivityChart.tsx). Not linked from the sidebar yet (founder decision 2026-10-14).
// Plan: mds/build/form-study/plan.md.
import Link from "next/link";
import { FormActivityChart } from "@/components/forms/FormActivityChart";
import { getFormActivities } from "@/lib/actions/formActivities.action";

export const dynamic = "force-dynamic";

const fmt = (ms: number | null) => {
  if (ms === null) return "-";
  const s = Math.round(ms / 1000);
  if (s < 60) return s + " s";
  const m = Math.floor(s / 60);
  return m < 60 ? m + "m " + (s % 60) + "s" : Math.floor(m / 60) + "h " + (m % 60) + "m";
};

const STATUS: Record<string, { label: string; cls: string }> = {
  submitted: { label: "Submitted", cls: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300" },
  abandoned: { label: "Started, not submitted", cls: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  started: { label: "In progress", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
};

export default async function FormActivitiesPage() {
  const { items, days } = await getFormActivities();
  const submitted = items.filter((i) => i.status === "submitted").length;
  const abandoned = items.filter((i) => i.status === "abandoned").length;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Form activities</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Every form someone started in the last {days} days, whether or not they submitted it. Open one to see it field by field: how long before they began, the order, the pauses, other pages, and when they left and came back. Only times are recorded, never what was typed.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span><strong>{items.length}</strong> started</span>
          <span><strong>{submitted}</strong> submitted</span>
          <span><strong>{abandoned}</strong> started but not submitted</span>
        </div>
      </header>

      {items.length === 0 && <p className="rounded-lg border p-6 text-sm text-muted-foreground">No form has been started on this site in the last {days} days.</p>}

      <ul className="space-y-3">
        {items.map((it) => {
          const st = STATUS[it.status] ?? { label: it.status, cls: "bg-muted text-muted-foreground" };
          const who = it.who ? it.who.name || it.who.email || "Lead" : "Visitor " + (it.visitorId ? it.visitorId.slice(0, 6) : "");
          const t = it.timeline.totals;
          return (
            <li key={it.id} className="rounded-lg border bg-card">
              <details>
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <span className="min-w-[10rem] font-medium text-foreground">
                    {it.who?.leadId ? (
                      <Link href={"/platform/leads/" + it.who.leadId} className="hover:underline">
                        {who}
                      </Link>
                    ) : (
                      who
                    )}
                  </span>
                  <span className={"rounded-full px-2 py-0.5 text-[11px] " + st.cls}>{st.label}</span>
                  <span className="text-xs text-muted-foreground">{it.page || "-"}</span>
                  <span className="text-xs text-muted-foreground">{it.seenAt ? new Date(it.seenAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}</span>
                  <span className="ml-auto flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                    <span>to start <strong className="text-foreground">{fmt(t.toStartMs)}</strong></span>
                    <span>in fields <strong className="text-foreground">{fmt(t.inFieldsMs)}</strong></span>
                    {t.awayMs > 0 && <span>away <strong className="text-foreground">{fmt(t.awayMs)}</strong></span>}
                    <span>{t.fieldsTouched} fields</span>
                  </span>
                </summary>
                <div className="border-t px-4 py-4">
                  <FormActivityChart timeline={it.timeline} />
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
