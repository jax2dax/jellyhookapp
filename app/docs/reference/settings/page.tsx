import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Site settings",
  description: "What can actually be changed about a site after it is created.",
  alternates: { canonical: "/docs/reference/settings" },
};

export default function SettingsReferencePage() {
  return (
    <div>
      <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Feature reference</span>
      <h1 className="mt-3 ff-display text-3xl text-[#f4f2ea]">Site settings</h1>
      <p className="mt-5 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
        A smaller list than it might seem. Some choices made when the site was first created cannot be changed
        here later.
      </p>

      <div className="mt-12 space-y-10">
        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Name and domain</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Both editable. Changing the domain here is a label change in the dashboard, it does not move the
            tracker script or affect anything already recorded.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">API key</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Can be copied or regenerated. Regenerating breaks any tracker script currently installed with the old
            key, since the old one stops being accepted the moment a new one is issued.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Pause and resume</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Pausing stops the site from accepting new tracking data without removing the script or any data
            already collected. Resume to start accepting it again.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">What is not here</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Whether the site tracks all forms or only ones labeled with{" "}
            <code className="ff-mono text-[#c9c7bd]">data-conversion=&quot;true&quot;</code> is chosen once, when
            the site is created, and there is currently no way to switch it afterward from this page.
          </p>
        </div>
      </div>
    </div>
  );
}
