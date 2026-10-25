// app/platform/settings/SettingsShell.jsx
// The frame of Settings: page title, the grouped sidebar and the chosen section's header, then its content. Shared by the
// real page (page.jsx) and the fake-data demo (app/dev/settings-demo), so what is checked in the demo is what customers
// see. No data fetching here. Sections: lib/settings/sections.js.
import { SettingsNav } from "./SettingsNav";

export function SettingsShell({ siteName, groups, active, section, children }) {
  return (
    <div className="flex flex-1 flex-col p-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Settings</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{siteName}</p>
        </header>

        <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
          <SettingsNav groups={groups} active={active} />

          <main className="min-w-0 max-w-3xl flex-1">
            <div className="mb-5">
              <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{section.group}</div>
              <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-foreground">{section.label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
            </div>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
