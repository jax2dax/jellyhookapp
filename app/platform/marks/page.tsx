// app/platform/marks/page.tsx
// The marks library: your marks by type, and published marks to add (components/marks/MarksLibrary.tsx).
import { InfoTip } from "@/components/forms/InfoTip";
import { MarksLibrary } from "@/components/marks/MarksLibrary";
import { loadMarks } from "@/lib/actions/marks.action";

export const dynamic = "force-dynamic";

export default async function MarksPage() {
  const state = await loadMarks();
  return (
    <div className="mx-auto w-full max-w-[1900px] space-y-5 p-6">
      <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        Marks
        <InfoTip>
          A mark puts a coloured badge on every lead that did what it describes. Add marks from the library: &quot;Add to marks&quot; gives you your own copy, which you can change. Marks arrive off: turn them on and apply them on the Leads page.
        </InfoTip>
      </h1>
      <MarksLibrary state={state} />
    </div>
  );
}
