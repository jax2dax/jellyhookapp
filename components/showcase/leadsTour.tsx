// components/showcase/leadsTour.tsx
// The home page demo's guided sequence: build a mark on the Leads page, apply it to the sample leads, then turn it
// into a hook that tells the team. Each step points at a [data-tour] element of the real components; the copy says
// only what those screens do (marketing/claims-ledger.md rows 23 to 25). To add another sequence, write another list
// of TourStep (components/tour/Tour.tsx) and pass it to the demo.
import type { TourStep } from "@/components/tour/Tour";
import type { DemoStore } from "./demoStore";

const T = (name: string) => `[data-tour="${name}"]`;

/** The row of the mark saved during the tour. */
const savedMarkRow = (store: DemoStore) => (stage: HTMLElement) => (store.lastMarkId ? stage.querySelector(`[data-tour="mark-row"][data-mark-id="${store.lastMarkId}"]`) : null);
const savedMark = (store: DemoStore) => store.marks.find((m) => m.id === store.lastMarkId);
const value = (stage: HTMLElement, name: string) => (stage.querySelector(T(name)) as HTMLInputElement | null)?.value.trim() ?? "";

export function leadsTour(store: DemoStore): TourStep[] {
  return [
    {
      id: "welcome",
      title: "This is the Leads page",
      body: (
        <>
          Every row is one form submission on a sample site. The panel on the right holds your <b className="text-white">marks</b>: conditions
          about what a lead did before sending the form. In two minutes you will build one, apply it, and get told when the next matching
          lead arrives.
        </>
      ),
    },
    {
      id: "new",
      target: T("marks-new"),
      title: "Create a mark",
      body: "A mark puts a coloured badge on every lead that did what you choose. Click New.",
      action: "Click New",
      placement: "left",
    },
    {
      id: "manual",
      target: T("builder-manual"),
      title: "Build it by hand",
      body: "A mark is made of plain conditions. Open the manual builder.",
      action: "Click Enter manually",
      placement: "left",
    },
    {
      id: "start-page",
      target: T("start-page"),
      title: "Choose what to check",
      body: "Visit conditions look at a whole visit. Page conditions look at one page. Form conditions look at their answers and how they filled the form. We want people who studied the pricing page.",
      action: "Click Page condition",
      placement: "left",
    },
    {
      id: "path",
      target: T("page-path"),
      title: "Which page?",
      body: (
        <>
          Type <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[12px] text-white">/pricing</code>. By default the page is checked in the visit they sent the form in.
        </>
      ),
      advance: { until: (stage) => value(stage, "page-path") === "/pricing" },
      fill: "/pricing",
      action: "Type /pricing",
      placement: "left",
    },
    {
      id: "cond-add",
      target: T("page-cond-add"),
      title: "What did they do on it?",
      body: "Add a condition on this page.",
      action: "Click Condition on this page",
      placement: "left",
    },
    {
      id: "cond-time",
      target: T("cond-time"),
      title: "Time on the page",
      body: "Choose Time on the page. It is measured the same way as the time on the lead's visit chart.",
      action: "Click Time on the page",
      placement: "left",
    },
    {
      id: "reads",
      advance: "next",
      target: T("mark-reads"),
      title: "Read it back before saving",
      body: "The builder writes the mark out in plain words. Here: on /pricing for at least 30 seconds, in the visit they sent the form in.",
      placement: "left",
    },
    {
      id: "name",
      target: T("mark-name"),
      title: "Name it",
      body: "Call it Pricing reader. The name is what your team sees on the badge.",
      advance: { until: (stage) => value(stage, "mark-name").length >= 3 },
      fill: "Pricing reader",
      action: "Type a name",
      placement: "left",
    },
    {
      id: "save",
      target: T("mark-save"),
      title: "Save the mark",
      body: "Saving checks every lead you already have. While the mark is on, each new lead is checked when it arrives.",
      action: "Click Save mark",
      placement: "left",
    },
    {
      id: "result",
      advance: "next",
      target: savedMarkRow(store),
      title: "Checked against every lead",
      body: () => {
        const m = savedMark(store);
        const n = m?.matchCount ?? 0;
        return `${n} of the ${store.leads.length} sample leads match ${m ? m.name : "the mark"}. They now carry its badge in the Marks column.`;
      },
      placement: "left",
    },
    {
      id: "apply",
      target: savedMarkRow(store),
      title: "Apply it to the table",
      body: "Click the mark. Its leads move to the top and the rest fade. This only changes the view; nothing is saved.",
      action: "Click the mark",
      placement: "left",
    },
    {
      id: "badges",
      advance: "next",
      target: T("lead-marks"),
      title: "Each badge says why",
      body: "Hover a badge: it names the mark and the evidence, for example the visit and the time on /pricing.",
      placement: "right",
    },
    {
      id: "more",
      target: (stage) => savedMarkRow(store)(stage)?.querySelector(T("mark-more")) ?? null,
      title: "Act on the next one",
      body: "Badges help with the leads you have. A hook catches the next lead with this mark. Open the mark's menu.",
      action: "Click the menu",
      placement: "left",
    },
    {
      id: "create-hook",
      target: T("mark-create-hook"),
      title: "Create a hook",
      body: "A hook watches every new lead. When a lead has all of its marks, the lead is hooked and your team is told.",
      action: "Click Create a hook",
      placement: "left",
    },
    {
      id: "hook-editor",
      advance: "next",
      target: T("hook-editor"),
      title: "The hook is ready to fill in",
      body: "It opened on the Hooks page with your mark already in it, and the mark's name as the hook's name.",
      placement: "bottom",
    },
    {
      id: "subject",
      target: T("hook-subject"),
      title: "Write what your team reads",
      body: "The subject is the first line of the notification.",
      advance: { until: (stage) => value(stage, "hook-subject").length >= 3 },
      fill: "Pricing reader: reply within the hour",
      action: "Type a subject",
      placement: "bottom",
    },
    {
      id: "slack",
      target: T("channel-slack"),
      title: "Where it goes",
      body: "Every hook notifies inside Jellyhook. Pick the sample Slack channel to post there too.",
      action: "Click #sales-leads",
      placement: "bottom",
    },
    {
      id: "customize",
      target: T("slack-customize"),
      title: "See the Slack message",
      body: "Open the message options to choose what the Slack message shows.",
      action: "Click Customize",
      placement: "bottom",
    },
    {
      id: "preview",
      advance: "next",
      target: T("slack-preview"),
      title: "The message, before it is sent",
      body: "The preview is drawn from the same blocks that are sent to Slack. Here it describes an example visit.",
      placement: "left",
    },
    {
      id: "create",
      target: T("hook-save"),
      title: "Create the hook",
      body: "It goes live at once.",
      action: "Click Create hook",
      placement: "top",
    },
    {
      id: "live",
      advance: "next",
      target: (stage) => [...stage.querySelectorAll(T("hook-row"))].pop() ?? null,
      title: "It is live",
      body: () => `From now on, every new lead marked ${savedMark(store)?.name ?? "by your mark"} is hooked, and the message goes to #sales-leads. The tour is done: keep exploring the demo, or start free on your own site.`,
      placement: "bottom",
    },
  ];
}
