// app/platform/loading.tsx
// Shown at once while a platform page loads on the server (every page reads the database), so a click in the sidebar
// answers immediately instead of leaving the old page on screen. A neutral outline: a title, a row of tiles, two cards.
export default function PlatformLoading() {
  return (
    <div className="p-6" role="status" aria-label="Loading">
      <div className="jh-skeleton h-6 w-40 rounded-md" />
      <div className="jh-skeleton mt-2 h-4 w-64 rounded-md" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-4">
            <div className="jh-skeleton h-3 w-20 rounded" />
            <div className="jh-skeleton mt-3 h-7 w-24 rounded-md" />
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 lg:col-span-2">
          <div className="jh-skeleton h-4 w-32 rounded" />
          <div className="mt-4 space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="jh-skeleton size-8 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="jh-skeleton h-3 w-1/3 rounded" />
                  <div className="jh-skeleton h-3 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="jh-skeleton h-4 w-24 rounded" />
          <div className="mt-4 space-y-2.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="jh-skeleton h-8 rounded-md" />
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
