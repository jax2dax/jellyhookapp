// lib/tracking/formKey.js
// A form's identity across pages and visits: "id:<id>", else "name:<name>", else "path:<page>#<position>". The tracker
// sends the raw id / name attributes (form_key_hint); this decides. Pure, tested (lib/tracking/tests/formKey.test.js).
// Design: mds/build/form-study/averages-and-versions.md section 2.
//
// Ids that look generated are ignored, because they change on every page load and would make each load a new form:
// React useId (":r1:"), anything with a long hex or digit run (hashes, uuids, timestamps). HubSpot's "hsForm_<guid>" is
// the exception: it is the same for every load of that HubSpot form.

const ALLOWED = /^[A-Za-z0-9_.:-]+$/;
const HUBSPOT = /^hsForm_[0-9a-f-]{8,}$/i;

/** true when the value is likely made up by a framework on each load */
export function looksGenerated(v) {
  if (HUBSPOT.test(v)) return false;
  if (v.startsWith(":") || v.includes(":r")) return true; // React useId: ":r1:", "radix-:r3:"
  if (/(?=[0-9a-f]*[0-9])(?=[0-9a-f]*[a-f])[0-9a-f]{8,}/i.test(v)) return true; // a hex run with digits and letters: a hash or uuid
  if (/[0-9]{9,}/.test(v)) return true; // a timestamp
  return false;
}

function cleanAttr(v) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length > 100 || !ALLOWED.test(s) || looksGenerated(s)) return null;
  return s;
}

/** The form's key. `hint` is { id, name } from the tracker (may be missing: older trackers). */
export function formKeyOf(hint, pagePath, formIndex) {
  const id = cleanAttr(hint && hint.id);
  if (id) return "id:" + id;
  const name = cleanAttr(hint && hint.name);
  if (name) return "name:" + name;
  return "path:" + pagePath + "#" + formIndex;
}

/** What a person reads: "#contact", "contact (name)", "/contact (form 1)". */
export function formKeyLabel(key) {
  if (typeof key !== "string") return "form";
  if (key.startsWith("id:")) return "#" + key.slice(3);
  if (key.startsWith("name:")) return key.slice(5) + " (name)";
  if (key.startsWith("path:")) {
    const rest = key.slice(5);
    const hash = rest.lastIndexOf("#");
    return hash > 0 ? rest.slice(0, hash) + " (form " + (Number(rest.slice(hash + 1)) + 1) + ")" : rest;
  }
  return key;
}
