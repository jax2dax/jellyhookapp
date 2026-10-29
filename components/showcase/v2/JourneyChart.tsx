"use client";
// components/showcase/v2/JourneyChart.tsx
// Home page, "One lead's visit chart": first the explanation video (public/frameplatedemo.mp4, muted, looping), then,
// on "See the interactive chart", the area flips over to the real visit chart on example data (ExampleFramePlate). The
// floating button sits over the video's bottom-right corner, which also hides the recording tool's watermark. If the
// video is missing or cannot play, the chart is shown straight away.
import * as React from "react";
import { ArrowRight, Play } from "lucide-react";
import { ExampleFramePlate } from "@/app/docs/concepts/session-replay/ExampleFramePlate";

// the explanation video (public/assets/Scene.mp4; the address is case-sensitive once deployed)
const VIDEO = "/assets/Scene.mp4";

export function JourneyChart() {
  const [side, setSide] = React.useState<"video" | "chart">("video");
  const [videoOk, setVideoOk] = React.useState(true);
  const video = React.useRef<HTMLVideoElement>(null);
  const showChart = side === "chart" || !videoOk;

  // the video can fail before this page is interactive (onError is then missed): ask the server once, and read the element
  React.useEffect(() => {
    let live = true;
    fetch(VIDEO, { method: "HEAD" })
      .then((r) => {
        if (live && !r.ok) setVideoOk(false);
      })
      .catch(() => {
        if (live) setVideoOk(false);
      });
    return () => {
      live = false;
    };
  }, []);

  const flipTo = (s: "video" | "chart") => {
    setSide(s);
    if (s === "video") video.current?.play().catch(() => {});
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-t-4 border-[var(--ink)] pt-3">
        <div className="flex items-center gap-3">
          {videoOk && (
            <button
              type="button"
              onClick={() => flipTo(showChart ? "video" : "chart")}
              className="inline-flex items-center gap-1.5 border-2 border-[var(--ink)] px-2.5 py-1 v2-caps text-[10px] transition-colors hover:border-[var(--spot)] hover:text-[var(--spot)]"
            >
              {showChart ? (
                <>
                  <Play className="h-3 w-3" /> Explanation
                </>
              ) : (
                <>
                  Interactive chart <ArrowRight className="h-3 w-3" />
                </>
              )}
            </button>
          )}
          <span className="v2-caps text-[11px]">One lead&apos;s visit chart</span>
        </div>
        <span className="v2-caps text-[11px] text-[var(--ink-soft)]">Example data</span>
      </div>

      {/* two faces in one grid cell; the card turns over between them */}
      <div className="[perspective:1600px]">
        <div
          className="grid transition-transform duration-700 ease-[cubic-bezier(0.65,0,0.35,1)] [transform-style:preserve-3d] motion-reduce:transition-none"
          style={{ transform: showChart ? "rotateY(180deg)" : "none" }}
        >
          <div className="relative [grid-area:1/1] [backface-visibility:hidden]" aria-hidden={showChart}>
            {videoOk && (
              <>
                <video
                  ref={video}
                  src={VIDEO}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  onError={() => setVideoOk(false)}
                  className="block aspect-video w-full border-2 border-[var(--ink)] bg-[var(--paper-2)] object-cover"
                />
                <button
                  type="button"
                  tabIndex={showChart ? -1 : 0}
                  onClick={() => flipTo("chart")}
                  className="group absolute bottom-0 right-0 inline-flex min-h-12 min-w-[13rem] items-center justify-center gap-2 bg-[var(--ink)] px-5 v2-caps text-[12px] text-white shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)] transition-colors hover:bg-[var(--spot)]"
                >
                  See the interactive chart
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
              </>
            )}
          </div>
          <div className="[grid-area:1/1] [backface-visibility:hidden] [transform:rotateY(180deg)]" aria-hidden={!showChart}>
            {/* mounted once the card is turned, so the chart measures its real width */}
            {showChart && <ExampleFramePlate />}
          </div>
        </div>
      </div>
    </div>
  );
}
