// components/InfoTip.tsx
// The small (i) next to a chart or tile title: hover or focus it for a
// short, plain explanation of what the chart shows and how it counts.
// Keyboard reachable; the explanation is also the button's accessible name.
"use client";

import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function InfoTip({ children, label = "About this" }: { children: React.ReactNode; label?: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            // inside a link card (the dashboard minis), the (i) must not navigate
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }} className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-72 text-xs leading-relaxed">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
