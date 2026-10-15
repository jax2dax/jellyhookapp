// app/dev/form-chart-demo/page.tsx
// DEMO with FAKE data: the form drawing (components/forms/FormActivityChart.tsx) for a few typical situations, so the
// layout can be judged without waiting for real traffic. Nothing here reads the database.
import { FormActivityChart } from "@/components/forms/FormActivityChart";
import { buildFormTimeline, type EngagementRow, type PageViewRow } from "@/jh-forms/timeline";

const T0 = Date.UTC(2026, 9, 14, 12, 0, 0);
const at = (s: number) => new Date(T0 + s * 1000).toISOString();

const FIELDS = [
  { key: "name", type: "text", required: true },
  { key: "custom:business_type", type: "select", required: false },
  { key: "email", type: "email", required: true },
  { key: "custom:preferred_contact_method", type: "select", required: false },
  { key: "phone", type: "tel", required: false },
  { key: "custom:message", type: "textarea", required: false },
];

// 1. a calm submission: three fields, one pause, nothing odd
const calm: EngagementRow = {
  session_id: "s1", page_path: "/contact", status: "submitted", viewed_at: at(0), first_input_at: at(6), ended_at: at(58), onscreen_before_start_ms: 5200, last_field_type: "email", form_fields: FIELDS,
  field_timings: {
    name: { order: 1, firstFocusAt: at(6), firstKeydownAt: at(7.5), lastUnfocusAt: at(19), totalFocusedMs: 13000, visits: [[at(6), at(19), 1]], filled: true, edits: 1 },
    "custom:business_type": { order: 2, firstFocusAt: at(19.01), firstKeydownAt: at(24), lastUnfocusAt: at(27), totalFocusedMs: 8000, visits: [[at(19.01), at(27), 1]], filled: true, edits: 1 },
    "custom:preferred_contact_method": { order: 3, firstFocusAt: at(27.5), firstKeydownAt: at(29), lastUnfocusAt: at(31.5), totalFocusedMs: 4000, visits: [[at(27.5), at(31.5), 1]], filled: true, edits: 1 },
    email: { order: 4, firstFocusAt: at(35), firstKeydownAt: at(36), lastUnfocusAt: at(58), totalFocusedMs: 23000, visits: [[at(35), at(58), 1]], filled: true, edits: 1 },
  },
};
const calmViews: PageViewRow[] = [{ page_view_id: "a", session_id: "s1", page_path: "/contact", entered_at: at(-20), left_at: at(60) }];

// 2. a messy one: leaves the site, comes back, a validation error, a field skipped, a short visit
const messy: EngagementRow = {
  session_id: "s2", page_path: "/contact", status: "abandoned", viewed_at: at(0), first_input_at: at(1), ended_at: at(480), onscreen_before_start_ms: 3000, last_field_type: "email", form_fields: FIELDS,
  field_timings: {
    name: { order: 1, firstFocusAt: at(1), firstKeydownAt: at(2), lastUnfocusAt: at(23), totalFocusedMs: 22000, visits: [[at(1), at(23), 1]], filled: true, edits: 1 },
    "custom:business_type": { order: 2, firstFocusAt: at(23.01), lastUnfocusAt: at(24), totalFocusedMs: 1000, visits: [[at(23.01), at(24), 0]], filled: false, edits: 0 },
    email: { order: 3, firstFocusAt: at(40), firstKeydownAt: at(41), lastUnfocusAt: at(480), totalFocusedMs: 20000, visits: [[at(40), at(60), 1], [at(470), at(480), 1]], filled: true, edits: 2, errors: 1 },
    phone: { order: 4, firstFocusAt: null, lastUnfocusAt: null, totalFocusedMs: 0, visits: [], edits: 0, errors: 1 },
  },
};
const messyViews: PageViewRow[] = [
  { page_view_id: "a", session_id: "s2", page_path: "/contact", entered_at: at(-10), left_at: at(70) },
  { page_view_id: "b", session_id: "s2", page_path: "/pricing", entered_at: at(70), left_at: at(120) },
  { page_view_id: "c", session_id: "s2", page_path: "/contact", entered_at: at(280), left_at: at(500) },
];

export default function FormChartDemoPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10 p-6">
      <header>
        <div className="text-xs font-medium uppercase tracking-wide text-amber-600">Demo, fake data</div>
        <h1 className="text-xl font-semibold">Form drawing</h1>
      </header>
      <FormActivityChart title="Submitted on /contact: a calm fill" timeline={buildFormTimeline(calm, calmViews)} />
      <FormActivityChart title="Started, not submitted: left the site, came back, an error, a skipped field" timeline={buildFormTimeline(messy, messyViews)} />
    </div>
  );
}
