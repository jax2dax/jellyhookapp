// components/notifications/Brand.tsx
// Logos and the square tile used for every delivery integration (Slack and webhooks today; more, such as a CRM, later).
// One tile per integration keeps the rule editor and the Channels tab the same as the list grows.
import * as React from "react";
import { Check, Webhook } from "lucide-react";

export function SlackLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" />
      <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" />
      <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" />
      <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  );
}

export function KindLogo({ kind, className }: { kind: "slack" | "webhook"; className?: string }) {
  return kind === "slack" ? <SlackLogo className={className} /> : <Webhook className={className + " text-foreground"} />;
}

/** A small square card: the logo, a name under it, and a check when selected. */
export function IntegrationTile({
  kind,
  label,
  selected,
  muted,
  onClick,
  title,
  tour,
}: {
  kind: "slack" | "webhook";
  label: string;
  selected?: boolean;
  muted?: boolean;
  onClick?: () => void;
  title?: string;
  /** a stable name for guided tours (components/tour) */
  tour?: string;
}) {
  return (
    <button
      type="button"
      data-tour={tour}
      onClick={onClick}
      title={title ?? label}
      aria-pressed={selected}
      className={
        "relative flex h-[72px] w-[84px] flex-col items-center justify-center gap-1.5 rounded-lg border bg-background px-1.5 transition-colors " +
        // not picked = dimmed and grey, so a channel never looks switched on before it is clicked
        (selected ? "border-primary ring-1 ring-primary" : "opacity-45 grayscale hover:opacity-80 hover:grayscale-0") +
        (muted && selected ? " opacity-70" : "")
      }
    >
      {selected && (
        <span className="absolute right-1 top-1 flex size-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-2.5" />
        </span>
      )}
      <KindLogo kind={kind} className="size-6" />
      <span className="w-full truncate text-center text-[11px] text-muted-foreground">{label}</span>
    </button>
  );
}

/** HubSpot's orange sprocket, drawn simply (a hub with three spokes). */
export function HubSpotLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <g fill="none" stroke="#FF7A59" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="14.5" cy="14.5" r="4" />
        <path d="M14.5 10.5V5.6M11.4 17.4l-4.6 3.8M10.8 12.4 5.4 8.6" />
      </g>
      <circle cx="14.5" cy="4" r="2.1" fill="#FF7A59" />
      <circle cx="4.4" cy="7.9" r="1.7" fill="#FF7A59" />
    </svg>
  );
}

/** In-app (Jellyhook): every hook always notifies inside Jellyhook, so this tile is always on and cannot be clicked. */
export function JellyhookTile() {
  return (
    <span
      title="Inside Jellyhook: always on"
      aria-label="Inside Jellyhook, always on"
      className="relative flex h-[72px] w-[84px] flex-col items-center justify-center gap-1.5 rounded-lg border border-primary bg-background px-1.5 ring-1 ring-primary"
    >
      <span className="absolute right-1 top-1 flex size-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="size-2.5" />
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/jellyhook-nobg.png" alt="" className="size-6 object-contain" />
      <span className="w-full truncate text-center text-[11px] text-muted-foreground">In app</span>
    </span>
  );
}
