import type { Metadata } from "next";
import { DocHeader, DataTable, DocFooter } from "../../ui";

export const metadata: Metadata = {
  title: "Hook glossary",
  description: "Every Hook term in one place.",
  alternates: { canonical: "/docs/hook/glossary" },
};

const TERMS: [string, string][] = [
  ["Hook", "The tool for asking precise questions about your visitors, sessions, leads and forms."],
  ["Query", "The saved description of a question: conditions, output, sub-hooks, names, notes and layout. No data, no site."],
  ["Condition", "A test on one value of the row, such as page is /pricing."],
  ["Connected rows", "Rows linked to the one you are looking at: a session's page views, a form's fields, a page view's next page. Tested with has at least one or count or total."],
  ["Group", "A set of conditions combined as any (OR), all (AND) or none of (NOT)."],
  ["Output", "What you want back: a number, a calculation, a list, values or a breakdown."],
  ["Breakdown", "A measure per value of a field, or per hour, day, week or month."],
  ["Measure", "number of, number of different, total, average, lowest, highest, median or percentile."],
  ["Sub-hook", "A complete hook whose result becomes a value inside another hook."],
  ["Tunnel", "The flow of a sub-hook's result into the hook above it."],
  ["Fit", "Whether a sub-hook's shape (one value or a list) and type suit the value it feeds."],
  ["Reads as", "The plain-English echo of your question shown under the builder."],
  ["Credit", "The unit a run is metered in. At least 1 per run, more for heavier questions, known before it runs."],
  ["Run order", "The order the top-level conditions are checked in. Never changes the answer, only the speed."],
  ["Away period", "A gap of 15 seconds or more between two page views of the same session."],
  ["Form friction", "Where and why people stall or give up on a form, from per-field timing."],
  ["Preview", "The live picture beside the builder showing what the question describes."],
  ["Results canvas", "The area under the builder where the answer is drawn."],
  ["Base rate", "The same measure without your conditions, shown beside a number for context."],
  ["Evidence", "The connected rows that made a result match, highlighted inside the result."],
];

export default function GlossaryPage() {
  return (
    <div>
      <DocHeader eyebrow="Hook" title="Glossary" intro="Every term used in the Hook documentation." />
      <div className="mt-10">
        <DataTable head={["Term", "Meaning"]} rows={TERMS.map(([t, d]) => [t, d])} />
      </div>
      <DocFooter feature="hook" />
    </div>
  );
}
