// components/leads/Collapse.tsx
// Opens and closes its content smoothly, both ways: the height grows from (and shrinks to) zero while the content fades.
// Always mounted, so closing animates too (a conditional render would just vanish). Closed content is hidden from
// keyboard and screen readers (`inert`). Used by the Page details and Session details buttons.
"use client";

import * as React from "react";

export function Collapse({ open, children, className }: { open: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={"grid transition-[grid-template-rows,opacity] duration-300 ease-out " + (open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0") + (className ? " " + className : "")} aria-hidden={!open} inert={!open}>
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
