// components/billing/ComingSoonVeil.tsx
// Billing is not ready for customers yet. The page stays in the app but is blurred and
// cannot be clicked, with a short message on top. Remove the wrapper to bring it back.
export function ComingSoonVeil({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none select-none blur-md" inert>
        {children}
      </div>
      <div className="absolute inset-0 flex items-start justify-center pt-24">
        <div className="rounded-lg border bg-card px-6 py-5 text-center shadow-lg">
          <div className="text-base font-semibold text-foreground">Billing is coming soon</div>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">Everything is included during early access. Nothing to pay and nothing to set up.</p>
        </div>
      </div>
    </div>
  );
}
