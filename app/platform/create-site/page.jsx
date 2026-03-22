"use client";

import { useState } from "react";
import { createSite } from "@/lib/actions/supabase.actions";

export default function CreateSitePage() {
  const [domain, setDomain] = useState("");
  const [script, setScript] = useState("");

  const handleSubmit = async () => {
    const site = await createSite({
      name: domain,
      domain,
    });
//const trackerScript = `<script src="jellyhook.vercel.app/tracker.js" data-key="${key}"></script>`;
    const trackerScript = `<script src="http://localhost:3000/tracker.js" data-key="${site.api_key}"></script>`;
    
    setScript(trackerScript);
  };

  return (
    <div className="p-6">
      <h1>Create Tracker</h1>

      <input
        placeholder="yourdomain.com"
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        className="border p-2"
      />

      <button onClick={handleSubmit} className="ml-2 border px-3 py-1">
        Generate Script
      </button>

      {script && (
        <pre className="mt-4 p-3 border bg-gray-100">{script}</pre>
      )}
    </div>
  );
}