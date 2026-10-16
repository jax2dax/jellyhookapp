// app/dev/lead-forms-demo/page.tsx
// DEMO with FAKE data: the lead page's Form activity card (components/forms/LeadFormsCard.tsx), simple and Advanced.
import { LeadFormsCard } from "@/components/forms/LeadFormsCard";
import { collectFormActivities } from "@/jh-forms/collect";
import { fakeRows } from "../form-dashboard-demo/fakeData";

export default function LeadFormsDemoPage() {
  const sent = fakeRows.find((r) => r.status === "submitted")!;
  const others = fakeRows.filter((r) => r.status === "abandoned").slice(0, 3);
  const activities = collectFormActivities([sent, ...others], []);
  return (
    <div className="mx-auto max-w-5xl space-y-3 p-6">
      <div className="text-xs font-medium uppercase tracking-wide text-amber-600">Demo, fake data</div>
      <LeadFormsCard activities={activities} references={{}} />
    </div>
  );
}
