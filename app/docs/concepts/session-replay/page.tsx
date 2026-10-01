import type { Metadata } from "next";
import { defaultTheme } from "@/framePlate";
import { ExampleFramePlate } from "./ExampleFramePlate";
import { TerminologyDiagram } from "./TerminologyDiagram";

export const metadata: Metadata = {
  title: "Session replay",
  description: "How to read the session replay chart on a lead's page, with a real interactive example.",
  alternates: { canonical: "/docs/concepts/session-replay" },
};

function Swatch({ color }: { color: string }) {
  return <span className="mr-2 inline-block h-3 w-3 rounded-sm border border-[#333]" style={{ backgroundColor: color }} />;
}

function ColorRow({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <li className="flex items-start gap-1">
      <Swatch color={color} />
      <span>
        <span className="text-[#f4f2ea]">{label}</span>{" "}
        <code className="ff-mono text-[11px] text-[#77756d]">{color}</code>: {desc}
      </span>
    </li>
  );
}

export default function SessionReplayPage() {
  const outcome = defaultTheme.frame.backgroundByOutcome;
  const bulbs = defaultTheme.bulbs;

  return (
    <div>
      <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Core concepts</span>
      <h1 className="mt-3 ff-display text-3xl text-[#f4f2ea]">Session replay</h1>
      <p className="mt-5 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
        Every page a lead visited is drawn as a small rectangle, in order, left to right, scaled to that page&apos;s
        real height. Below is a made-up example session with four pages, built to show every signal in one place.
        It is interactive: click a frame.
      </p>

      <div className="mt-8">
        <ExampleFramePlate />
      </div>

      <div className="mt-14">
        <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Frame, plate, bulb, and the form mini-plate: what each one represents</h2>
        <p className="mb-6 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
          These four words get used precisely from here on, matching exactly what the code itself calls them. Each
          one stands in for something real about the visit — not just a shape with a name, but a specific
          measurement, drawn so that measurement can be read at a glance.
        </p>
        <TerminologyDiagram />
        <ul className="mt-6 max-w-2xl space-y-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
          <li>
            <span className="text-[#f4f2ea]">Frame:</span> the whole colored column for one page visit, or one gap
            away from the site. Its <span className="text-[#f4f2ea]">width represents how long that visit lasted</span> —
            visits of similar length land at a similar width; one unusually long outlier grows past the rest rather
            than squeezing everything else down to a sliver. Its{" "}
            <span className="text-[#f4f2ea]">color represents the outcome</span> of that visit — what
            &quot;gray,&quot; &quot;yellow,&quot; &quot;orange&quot; below actually mean.
          </li>
          <li>
            <span className="text-[#f4f2ea]">Plate:</span> the smaller rectangle inside the frame.{" "}
            <span className="text-[#f4f2ea]">Represents the entire real page, true height</span> — its height is
            that page&apos;s actual pixel height scaled down by a fixed ratio, clamped to a sensible minimum and
            maximum so a very short or very tall page both stay legible. That scaling never depends on any other
            page in the session: the same real page height always draws the same plate height, wherever it appears.
            The shaded seen and unseen areas live here, not on the frame.
          </li>
          <li>
            <span className="text-[#f4f2ea]">Bulb:</span> a small marker sticking out from the plate&apos;s own
            edge, not the frame&apos;s. Each one <span className="text-[#f4f2ea]">represents one specific moment</span>{" "}
            — entering the page, leaving it, or the furthest point ever scrolled to — and its{" "}
            <span className="text-[#f4f2ea]">position along that edge represents where on the page that moment
            happened</span>, top to bottom, on the same scale the plate itself is drawn to.
          </li>
          <li>
            <span className="text-[#f4f2ea]">Form mini-plate:</span> an inset box drawn <em>inside</em> the plate,
            not on its edge like a bulb. <span className="text-[#f4f2ea]">Represents the form&apos;s own real
            measured position and span on the page</span> — where it actually sits, top to bottom, not a single
            point. Narrower than the plate itself, so the seen/seen-twice shading stays visible either side of it.
            See below for exactly when it appears and what the stripes inside it mean.
          </li>
        </ul>
      </div>

      <div className="mt-14">
        <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">The form mini-plate, precisely</h2>
        <p className="max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
          It appears whenever a form on that page was ever seen at least 50% on screen — which needs no interaction
          at all, not typing, not even focusing a field, just scrolling it into view. That means it can show up on a
          visit that never converted and never even started the form: seeing it is enough. If a form was never
          scrolled into view at all on a given visit, the mini-plate does not appear — there is nothing measured
          yet, so nothing is drawn.
        </p>
        <ul className="mt-4 space-y-2.5 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
          <ColorRow
            color={defaultTheme.bulbs.converted.color}
            label="Darker yellow"
            desc="the form was seen, and maybe started, but not submitted on this visit."
          />
          <ColorRow
            color="#fde047"
            label="Bright yellow"
            desc="the form was actually submitted on this visit."
          />
        </ul>
        <p className="mt-4 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
          The white stripes inside it are fields — but specifically, fields that were actually clicked into at least
          once. A field nobody ever focused leaves no trace at all, so the stripe count is a floor on the form&apos;s
          real field count, never the true total. However many there are, they always stay inside the mini-plate:
          each stripe&apos;s thickness is the mini-plate&apos;s own height divided by the field count, so more
          fields means thinner stripes, not an overflowing box.
        </p>
      </div>

      <div className="mt-14 space-y-10">
        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Frame colors, exact values</h2>
          <p className="mb-4 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
            A frame&apos;s color always represents that visit&apos;s outcome — never its duration or how far they
            scrolled, which live in the frame&apos;s width and the bulbs instead.
          </p>
          <ul className="space-y-2.5 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
            <ColorRow color={outcome.exitedNormally} label="Gray" desc="a normal page visit, nothing unusual." />
            <ColorRow color={outcome.converted} label="Yellow" desc="a form on this page was submitted." />
            <ColorRow color={outcome.abandoned} label="Orange" desc="a form on this page was started, never submitted." />
            <ColorRow color={outcome.away} label="Purple" desc="not a page. Time spent away from the site between two page views." />
            <ColorRow color={outcome.live} label="Blue" desc="the visitor is looking at this exact page right now." />
          </ul>
          <p className="mt-4 max-w-2xl ff-body text-[13px] leading-relaxed text-[#77756d]">
            The whole chart also gets a{" "}
            <Swatch color={defaultTheme.sessionLiveBorder.color} />
            <code className="ff-mono text-[11px]">{defaultTheme.sessionLiveBorder.color}</code> border while the
            session itself has not ended yet. That is a different signal from any one frame&apos;s color, and can be
            true even after the visitor has moved on from whichever page is drawn last.
          </p>
          <p className="mt-3 max-w-2xl ff-body text-[13px] leading-relaxed text-[#77756d]">
            Two more outcomes exist behind the scenes — a plain green for &quot;still active&quot; and a dark red
            for &quot;expired&quot; — but nothing in the product assigns either of them to a real page visit today,
            so they are never something you will actually see on a chart.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">The seen and unseen bands inside a plate</h2>
          <ul className="space-y-2.5 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
            <ColorRow color={defaultTheme.seenOnce.color} label="Lighter fill" desc="content they scrolled past once." />
            <ColorRow color={defaultTheme.seenTwice.color} label="Darker fill" desc="content their scroll position crossed twice, once going down, once coming back up." />
            <ColorRow color={defaultTheme.plate.baseColor} label="Unfilled" desc="never on screen at all during that visit." />
          </ul>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">The bulbs, exact values</h2>
          <p className="mb-4 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
            A bulb&apos;s color represents which moment it marks; its position along the plate&apos;s edge
            represents where on the page that moment happened.
          </p>
          <ul className="space-y-2.5 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
            <ColorRow color={bulbs.enter.color} label="Green" desc="where they entered the page." />
            <ColorRow color={bulbs.exit.color} label="Red" desc="where they were when they left it." />
            <ColorRow color={bulbs.deepestScroll.color} label="Blue" desc="the furthest point they ever scrolled to on that page." />
          </ul>
          <p className="mt-4 max-w-2xl ff-body text-[13px] leading-relaxed text-[#77756d]">
            There used to be a fourth, yellow bulb marking a converted page&apos;s form position. It is now the form
            mini-plate described above for anything tracked since; the single-point yellow bulb only still appears
            as a fallback for a conversion recorded before form position tracking existed at all.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Headings and the one-screen-height lines</h2>
          <p className="max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
            The small zigzag marks on the plate stand in for a heading on the real page, at the actual position it
            sits on that page. The dashed lines mark every multiple of one full screen&apos;s height, scaled to
            whatever device that particular visit happened on, so a phone visit and a desktop visit to the same
            page do not use the same spacing.
          </p>
        </div>
      </div>
    </div>
  );
}
