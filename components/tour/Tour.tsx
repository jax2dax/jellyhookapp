"use client";
// components/tour/Tour.tsx
// Guided tours: a card that explains one step and points at one thing on the screen. The tour does not move on until
// the person does what the step asks: clicks the highlighted element, types the value, or presses Next. Everything
// else on the stage is blocked while a step is open (clicks outside the target are stopped before they reach the app).
//
// A tour is data (TourStep[]), so the same engine runs any sequence on any screen. Steps find their element with a
// selector inside the stage; [data-tour="..."] attributes on the real components are the stable way (a label can
// change, the attribute stays). A step whose element cannot be found for a few seconds offers "Skip this step", so a
// changed screen never traps anyone.
//
// The stage may be scaled with a CSS transform (the home page demo): positions are measured on screen and divided by
// the stage's scale, so the spotlight and the card sit right at any size.
import * as React from "react";
import { ArrowRight, MousePointerClick, RotateCcw, Keyboard, X } from "lucide-react";

export interface TourStep {
  id: string;
  /** what to point at: a selector inside the stage, or a function that finds it. None: a centred card. */
  target?: string | ((stage: HTMLElement) => Element | null);
  title: string;
  body: React.ReactNode | (() => React.ReactNode);
  /**
   * how the step ends: "click" on the target (the default with a target), "next" (a button on the card; the default
   * without a target), or { until }: a check on the stage that turns true (typing a value, picking an option)
   */
  advance?: "click" | "next" | { until: (stage: HTMLElement) => boolean };
  /** a value the card can type into the target field for the person ("Type it for me") */
  fill?: string;
  /** what the card's footer asks for ("Click New"); a sensible default otherwise */
  action?: string;
  /** where the card prefers to sit; it moves to another side when there is no room */
  placement?: "top" | "bottom" | "left" | "right";
  /** space around the spotlight, in px */
  pad?: number;
}

type Rect = { x: number; y: number; w: number; h: number };
type Box = { w: number; h: number };

const CARD_W = 336;
const GAP = 14;
const EDGE = 12;
const LOST_AFTER_MS = 3500;

const kind = (s: TourStep): "click" | "next" | "until" => (typeof s.advance === "object" ? "until" : s.advance ?? (s.target ? "click" : "next"));

function find(s: TourStep, stage: HTMLElement): HTMLElement | null {
  if (!s.target) return null;
  const el = typeof s.target === "string" ? stage.querySelector(s.target) : s.target(stage);
  if (!(el instanceof HTMLElement)) return null;
  // hidden (display: none, or zero size): not there yet
  const r = el.getBoundingClientRect();
  return r.width > 0 || r.height > 0 ? el : null;
}

/** Types a value into a React-controlled field: the native setter, then the input event React listens to. */
export function typeInto(el: Element | null, value: string) {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
  const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.focus();
}

/** Scrolls the nearest scrolling box inside the stage so the element is in view (never the page itself). */
function bringIntoView(el: HTMLElement, stage: HTMLElement) {
  let box: HTMLElement | null = el.parentElement;
  while (box && box !== stage) {
    const st = getComputedStyle(box);
    if (/(auto|scroll)/.test(st.overflowY) && box.scrollHeight > box.clientHeight) {
      const b = box.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const scale = b.height / box.offsetHeight || 1;
      if (r.top < b.top + 8 || r.bottom > b.bottom - 8) {
        const delta = (r.top - b.top) / scale - (box.clientHeight - r.height / scale) / 2;
        box.scrollTo({ top: box.scrollTop + delta, behavior: "smooth" });
      }
      return;
    }
    box = box.parentElement;
  }
}

/** Where the card goes: the preferred side if it fits, else the first side that fits, else inside the stage's corner. */
function place(target: Rect | null, card: Box, stage: Box, prefer?: TourStep["placement"]): { x: number; y: number } {
  if (!target) return { x: (stage.w - card.w) / 2, y: Math.max(EDGE, (stage.h - card.h) / 2) };
  const clampX = (x: number) => Math.min(Math.max(EDGE, x), stage.w - card.w - EDGE);
  const clampY = (y: number) => Math.min(Math.max(EDGE, y), stage.h - card.h - EDGE);
  const cx = target.x + target.w / 2;
  const cy = target.y + target.h / 2;
  const options = {
    bottom: { x: clampX(cx - card.w / 2), y: target.y + target.h + GAP, fits: target.y + target.h + GAP + card.h <= stage.h - EDGE },
    top: { x: clampX(cx - card.w / 2), y: target.y - GAP - card.h, fits: target.y - GAP - card.h >= EDGE },
    right: { x: target.x + target.w + GAP, y: clampY(cy - card.h / 2), fits: target.x + target.w + GAP + card.w <= stage.w - EDGE },
    left: { x: target.x - GAP - card.w, y: clampY(cy - card.h / 2), fits: target.x - GAP - card.w >= EDGE },
  };
  const order = [prefer, "bottom", "left", "right", "top"].filter(Boolean) as (keyof typeof options)[];
  const hit = order.find((k) => options[k].fits);
  if (hit) return { x: options[hit].x, y: options[hit].y };
  return { x: stage.w - card.w - EDGE, y: stage.h - card.h - EDGE };
}

const same = (a: Rect | null, b: Rect | null) => (!a && !b) || (!!a && !!b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5);

export function Tour({
  steps,
  stage,
  onFinish,
  onExit,
  onRestart,
  finishLabel = "Finish",
}: {
  steps: TourStep[];
  /** the element the tour lives in: positioned (relative), with overflow hidden */
  stage: React.RefObject<HTMLElement | null>;
  onFinish: () => void;
  /** the person closed the tour early */
  onExit: () => void;
  /** start over; without it the tour only goes back to its first step (the host may also reset its own screen) */
  onRestart?: () => void;
  finishLabel?: string;
}) {
  const [i, setI] = React.useState(0);
  const step = steps[Math.min(i, steps.length - 1)];
  const k = kind(step);
  const [rect, setRect] = React.useState<Rect | null>(null);
  const [stageBox, setStageBox] = React.useState<Box>({ w: 0, h: 0 });
  const [cardBox, setCardBox] = React.useState<Box>({ w: CARD_W, h: 180 });
  // the id of a step whose element did not show up in time
  const [lostStep, setLostStep] = React.useState<string | null>(null);
  const lost = lostStep === step.id;
  const cardRef = React.useRef<HTMLDivElement>(null);
  const targetRef = React.useRef<HTMLElement | null>(null);
  const advancing = React.useRef(false);
  const last = i >= steps.length - 1;

  const next = React.useCallback(() => {
    if (advancing.current) return;
    advancing.current = true;
    if (last) {
      onFinish();
      return;
    }
    setI((n) => n + 1);
  }, [last, onFinish]);

  // a new step: forget the old target, allow advancing again, start the "lost" clock
  React.useEffect(() => {
    advancing.current = false;
    targetRef.current = null;
    if (!step.target) return;
    const t = setTimeout(() => !targetRef.current && setLostStep(step.id), LOST_AFTER_MS);
    return () => clearTimeout(t);
  }, [step]);

  // follow the target every frame (it can move: a panel flips, a menu opens, a list re-sorts)
  React.useEffect(() => {
    const root = stage.current;
    if (!root) return;
    let raf = 0;
    let seen = false;
    let prev: Rect | null = null;
    const tick = () => {
      const s = root.getBoundingClientRect();
      const scale = s.width / root.offsetWidth || 1;
      setStageBox((b) => (b.w === root.offsetWidth && b.h === root.offsetHeight ? b : { w: root.offsetWidth, h: root.offsetHeight }));
      const el = find(step, root);
      targetRef.current = el;
      let r: Rect | null = null;
      if (el) {
        if (!seen) {
          seen = true;
          setLostStep(null);
          bringIntoView(el, root);
        }
        const b = el.getBoundingClientRect();
        const pad = step.pad ?? 6;
        r = { x: (b.left - s.left) / scale - pad, y: (b.top - s.top) / scale - pad, w: b.width / scale + pad * 2, h: b.height / scale + pad * 2 };
      }
      if (!same(prev, r)) {
        prev = r;
        setRect(r);
      }
      if (k === "until" && typeof step.advance === "object" && step.advance.until(root)) {
        setTimeout(next, 450);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step, stage, k, next]);

  // the card's own size, for placing it
  React.useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCardBox({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // block everything on the stage but the target (and the card); a click on the target moves the tour on
  React.useEffect(() => {
    const root = stage.current;
    if (!root) return;
    const allowed = (t: EventTarget | null) => {
      const node = t as Node | null;
      if (!node) return false;
      if (cardRef.current?.contains(node)) return true;
      if (k === "next") return false;
      return !!targetRef.current?.contains(node);
    };
    const guard = (e: Event) => {
      if (allowed(e.target)) return;
      e.stopPropagation();
      e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      if (!allowed(e.target)) return guard(e);
      if (k === "click" && targetRef.current?.contains(e.target as Node)) setTimeout(next, 60);
    };
    const onKey = (e: KeyboardEvent) => {
      // typing goes to the field of an "until" step; Enter and Space elsewhere would press a blocked button
      if ((e.key === "Enter" || e.key === " ") && !allowed(e.target)) guard(e);
    };
    const opts = { capture: true };
    const kinds = ["pointerdown", "mousedown", "mouseup", "pointerup", "dblclick", "contextmenu"] as const;
    for (const t of kinds) root.addEventListener(t, guard, opts);
    root.addEventListener("click", onClick, opts);
    root.addEventListener("keydown", onKey, opts);
    return () => {
      for (const t of kinds) root.removeEventListener(t, guard, opts);
      root.removeEventListener("click", onClick, opts);
      root.removeEventListener("keydown", onKey, opts);
    };
  }, [stage, k, next]);

  // Enter on an explanation step moves on, like the Next button
  React.useEffect(() => {
    if (k !== "next") return;
    const root = stage.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      // only when nothing else has the keyboard (or the focus is inside the stage), and the stage is on screen
      const a = document.activeElement;
      if (a && a !== document.body && !root?.contains(a)) return;
      const r = root?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) return;
      e.preventDefault();
      next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [k, next, stage]);

  const pos = place(rect, cardBox, stageBox, step.placement);
  const body = typeof step.body === "function" ? (step.body as () => React.ReactNode)() : step.body;
  const hint = step.action ?? (k === "click" ? "Click the highlighted element" : k === "until" ? "Do it in the highlighted field" : "");

  return (
    <div className="pointer-events-none absolute inset-0 z-[70]" data-tour-ui>
      {/* the dim layer, with a hole around the target */}
      {rect ? (
        <div
          className="absolute rounded-lg transition-[left,top,width,height] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, boxShadow: "0 0 0 9999px rgba(4,4,3,.58), 0 0 0 1.5px #c5ff3d, 0 0 24px 2px rgba(197,255,61,.22)" }}
        >
          {k === "click" && <span className="jh-tour-ping absolute inset-0 rounded-lg" aria-hidden />}
        </div>
      ) : (
        <div className="absolute inset-0 bg-[rgba(4,4,3,.58)] transition-opacity duration-300" />
      )}

      {/* the card */}
      <div
        ref={cardRef}
        role="dialog"
        aria-live="polite"
        aria-label={step.title}
        className="pointer-events-auto absolute left-0 top-0 rounded-xl border border-white/10 bg-[#121211] text-[#ecebe5] shadow-[0_24px_60px_-12px_rgba(0,0,0,.65)] transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
        style={{ width: CARD_W, transform: `translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px)` }}
      >
        <div key={step.id} className="jh-tour-card-in p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#8f8d84]">
              Step {i + 1} of {steps.length}
            </span>
            <span className="flex items-center gap-0.5">
              {i > 0 && (
                <button type="button" onClick={() => (onRestart ? onRestart() : setI(0))} className="flex size-6 items-center justify-center rounded-md text-[#8f8d84] hover:bg-white/5 hover:text-white" title="Restart the tour" aria-label="Restart the tour">
                  <RotateCcw className="size-3.5" />
                </button>
              )}
              <button type="button" onClick={onExit} className="flex size-6 items-center justify-center rounded-md text-[#8f8d84] hover:bg-white/5 hover:text-white" title="Close the tour and explore on your own" aria-label="Close the tour">
                <X className="size-3.5" />
              </button>
            </span>
          </div>
          <h3 className="mt-2 text-[15px] font-semibold leading-snug text-white">{step.title}</h3>
          <div className="mt-1.5 text-[13px] leading-relaxed text-[#b4b2aa]">{body}</div>

          {lost ? (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[12px] text-amber-100">
              This step&apos;s element is not on screen.
              <button type="button" onClick={next} className="shrink-0 rounded-md bg-amber-300 px-2 py-1 text-[11px] font-semibold text-black hover:bg-amber-200">
                Skip this step
              </button>
            </div>
          ) : k === "next" ? (
            <div className="mt-4 flex items-center justify-end">
              <button type="button" onClick={next} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#c5ff3d] px-3 text-[13px] font-semibold text-black transition hover:bg-[#d6ff73]">
                {last ? finishLabel : "Next"} <ArrowRight className="size-3.5" />
              </button>
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
              <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-[#c5ff3d]">
                {k === "click" ? <MousePointerClick className="size-3.5 shrink-0" /> : <Keyboard className="size-3.5 shrink-0" />}
                <span className="truncate">{hint}</span>
              </span>
              {step.fill && (
                <button type="button" onClick={() => typeInto(targetRef.current, step.fill!)} className="shrink-0 rounded-md border border-white/15 px-2 py-1 text-[11px] text-[#d8d6ce] hover:bg-white/5">
                  Type it for me
                </button>
              )}
            </div>
          )}
        </div>
        <div className="h-0.5 overflow-hidden rounded-b-xl bg-white/5">
          <div className="h-full bg-[#c5ff3d] transition-[width] duration-500 ease-out" style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
