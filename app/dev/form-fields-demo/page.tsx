"use client";
// DEMO with FAKE data: Settings → Form fields (components/forms/FormFieldsSettings.tsx) and the popup shown when a
// mark names a field the site does not have (components/forms/FieldNamingHelp.tsx). Naming a field calls the real
// action, which needs a signed-in site, so here it shows its error.
import * as React from "react";
import { FormFieldsSettings } from "@/components/forms/FormFieldsSettings";
import { FieldNamingHelp } from "@/components/forms/FieldNamingHelp";
import { buildCatalog } from "@/lib/forms/catalog";

const fields = buildCatalog(
  [
    {
      form_key: "id:contact",
      page_path: "/contact",
      form_fields: [
        { key: "email", type: "email", label: "Work email" },
        { key: "custom:field_3", type: "text" },
        { key: "custom:field_4", type: "text", label: "Monthly budget" },
        { key: "custom:company_size", type: "number", min: 1, max: 5000 },
        { key: "custom:budget", type: "radio", label: "Budget range", options: [{ v: "tier_1", l: "Under $1k" }, { v: "tier_2", l: "$1k-$5k" }, { v: "tier_3", l: "$5k+" }] },
        { key: "custom:service", type: "select", label: "Service", options: [{ v: "brand", l: "Branding" }, { v: "web", l: "Web design" }, { v: "seo", l: "SEO" }] },
        { key: "custom:consent", type: "checkbox", label: "I agree to be contacted", options: [{ v: "yes", l: "I agree to be contacted" }] },
      ],
    },
  ],
  [],
  [
    { field_3: "not sure", field_4: "$3,000", company_size: "40", budget: "tier_2", service: "web", consent: "yes" },
    { field_4: "5k", company_size: "12", service: "seo", consent: "yes" },
    { field_4: "10000", field_3: "hello", budget: "tier_3" },
  ],
);

export default function FormFieldsDemo() {
  const [help, setHelp] = React.useState(true);
  return (
    <div className="space-y-6 p-6">
      <div className="text-xs font-semibold uppercase tracking-wide text-orange-500">Demo, fake data</div>
      <FormFieldsSettings fields={fields} namesReady focusKey={null} />
      <button type="button" onClick={() => setHelp(true)} className="rounded-md border px-3 py-1.5 text-sm">
        Show the popup
      </button>
      {help && <FieldNamingHelp asked="revenue" known={fields} onClose={() => setHelp(false)} />}
    </div>
  );
}
