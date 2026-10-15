// components/forms/InfoTip.tsx
// A small (i) that opens a short explanation on hover or keyboard focus. For text that is narrative, not a sub header.
export function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <span className="group relative inline-flex align-middle" tabIndex={0} role="note" aria-label="More information">
      <span className="inline-flex size-4 items-center justify-center rounded-full border text-[10px] font-semibold text-muted-foreground group-hover:text-foreground">i</span>
      <span className="pointer-events-none absolute left-0 top-6 z-20 hidden w-80 max-w-[80vw] rounded-md border bg-popover p-3 text-xs font-normal normal-case leading-relaxed tracking-normal text-popover-foreground shadow-md group-hover:block group-focus:block">
        {children}
      </span>
    </span>
  );
}
