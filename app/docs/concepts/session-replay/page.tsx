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
        <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Frame, plate, and bulb: three different things</h2>
        <p className="mb-6 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
          These three words get used precisely from here on, matching exactly what the code itself calls them, so
          they need to be told apart once, clearly.
        </p>
        <TerminologyDiagram />
        <ul className="mt-6 max-w-2xl space-y-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
          <li>
            <span className="text-[#f4f2ea]">Frame:</span> the whole colored column for one page visit, or one gap.
            Its width changes with how long that visit lasted. Its color is what &quot;gray,&quot; &quot;yellow,&quot;
            &quot;orange&quot; below actually refer to.
          </li>
          <li>
            <span className="text-[#f4f2ea]">Plate:</span> the smaller rectangle inside the frame. This is the
            actual miniature of the real page, always the same width, its height scaled to that specific page&apos;s
            real height. The shaded seen and unseen areas live here, not on the frame.
          </li>
          <li>
            <span className="text-[#f4f2ea]">Bulb:</span> a small marker sticking out from the plate&apos;s own edge,
            not the frame&apos;s edge. Each one marks one specific moment or position, enter, exit, deepest scroll,
            or a submitted form&apos;s location.
          </li>
        </ul>
      </div>

      <div className="mt-14 space-y-10">
        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Frame colors, exact values</h2>
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
          <ul className="space-y-2.5 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
            <ColorRow color={bulbs.enter.color} label="Green" desc="where they entered the page." />
            <ColorRow color={bulbs.exit.color} label="Red" desc="where they were when they left it." />
            <ColorRow color={bulbs.deepestScroll.color} label="Blue" desc="the furthest point they ever scrolled to on that page." />
            <ColorRow
              color={bulbs.converted.color}
              label="Yellow bar"
              desc="the real measured position of the submitted form, stretched to its actual length. Only present for conversions recorded after form position tracking was added. Older ones fall back to a single dot at the exit point."
            />
          </ul>
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
