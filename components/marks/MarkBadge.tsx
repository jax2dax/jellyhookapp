// components/marks/MarkBadge.tsx
// A mark on a lead. In the table it is a coloured dot that widens to show the mark's name on hover, with the reason in
// the tooltip ("/pricing: 2 views, longest 40 s"). On the lead's page it is a full pill with the reason beside it.
export interface BadgeMark {
  id: string;
  name: string;
  color: string;
}

export function MarkDot({ mark, parts }: { mark: BadgeMark; parts?: string[] }) {
  const why = parts?.length ? mark.name + ": " + parts.join(" · ") : mark.name;
  return (
    <span
      title={why}
      className="group/mark inline-flex h-5 max-w-5 items-center overflow-hidden rounded-full transition-[max-width] duration-200 ease-out hover:max-w-48"
      style={{ backgroundColor: mark.color + "26", boxShadow: `inset 0 0 0 1px ${mark.color}66` }}
    >
      <span className="ml-[5px] size-2.5 shrink-0 rounded-full" style={{ backgroundColor: mark.color }} />
      <span className="whitespace-nowrap pl-1.5 pr-2 text-[11px] font-medium text-foreground opacity-0 transition-opacity duration-150 group-hover/mark:opacity-100">{mark.name}</span>
    </span>
  );
}

export function MarkDots({ marks }: { marks: { mark: BadgeMark; parts?: string[] }[] }) {
  if (!marks.length) return null;
  return (
    <span className="inline-flex flex-nowrap items-center gap-1">
      {marks.map((m) => (
        <MarkDot key={m.mark.id} mark={m.mark} parts={m.parts} />
      ))}
    </span>
  );
}

/** The lead page: the mark's name, and why this lead has it. */
export function MarkPill({ mark, parts }: { mark: BadgeMark; parts: string[] }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full py-0.5 pl-1.5 pr-3 text-xs" style={{ backgroundColor: mark.color + "1f", boxShadow: `inset 0 0 0 1px ${mark.color}59` }}>
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: mark.color }} />
      <span className="font-medium text-foreground">{mark.name}</span>
      {parts.length > 0 && <span className="truncate text-muted-foreground">{parts.join(" · ")}</span>}
    </span>
  );
}
