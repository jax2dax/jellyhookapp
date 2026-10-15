// lib/tracking/sensitive.js
// Which submitted form values must NEVER be stored: payment cards, bank accounts, government identity numbers. The
// tracker (public/tracker.js, "SENSITIVE FIELDS") applies the same rules in the browser, so these values normally
// never leave the visitor's page; this file is the server's second line of defence in /api/track-form, for old
// cached trackers, HubSpot payloads and anything unexpected. Keep the two in step. Pure; tested in
// lib/tracking/tests/sensitive.test.ts. Documentation: /docs/concepts/sensitive-fields, mds/documentation/sensitive-fields.md.

/** Lower-case, spaces and dashes to underscores: "Card Number" and "card-number" both become "card_number". */
export function normalizeKey(s) {
  return String(s || "").toLowerCase().replace(/[-\s.]+/g, "_");
}

// Matched as whole words of a normalized name / id / placeholder / label ("card_number", "your_ssn", "iban").
const SENSITIVE_WORDS = [
  // payment cards
  "cc_?num(ber)?", "cc_?no", "card_?(number|num|no)", "cardnumber", "credit_?card(_?number)?", "debit_?card(_?number)?", "pan",
  "cvv2?", "cvc2?", "csc", "security_?code", "card_?(code|verification|cvv|cvc)", "card_?exp(iry|iration)?(_?date)?",
  // bank accounts
  "iban", "bic", "swift(_?code)?", "routing(_?number)?", "aba", "sort_?code", "account_?(number|num|no)", "acct_?(number|num|no)?", "bank_?account(_?number)?",
  // government identity and tax numbers
  "ssn", "social_?security(_?number)?", "sin", "nino", "national_?insurance(_?number)?", "national_?id(_?number)?",
  "passport(_?(number|no))?", "tax_?(id|number|no)", "tin", "itin", "ein",
  // secrets
  "pin", "password", "passwd",
];
const SENSITIVE_RE = new RegExp("(^|_)(" + SENSITIVE_WORDS.join("|") + ")(_|$)");

export function isSensitiveName(name) {
  const n = normalizeKey(name);
  return n !== "" && SENSITIVE_RE.test(n);
}

/** Luhn checksum on the digits only: true for valid payment-card numbers (and, by chance, some other numbers). */
function luhn(digits) {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/**
 * A value that is a payment-card number (13 to 19 digits, spaces or dashes allowed, passing the Luhn check) or a
 * US social security number (123-45-6789). `phoneLike` skips the card check for phone fields, where a long number
 * passing Luhn by chance is much more likely than a card.
 */
export function isSensitiveValue(value, phoneLike = false) {
  const v = String(value == null ? "" : value).trim();
  if (!v) return false;
  if (/^\d{3}-\d{2}-\d{4}$/.test(v)) return true;
  if (phoneLike || v.startsWith("+")) return false;
  if (!/^[\d\s-]+$/.test(v)) return false;
  const digits = v.replace(/[\s-]/g, "");
  return digits.length >= 13 && digits.length <= 19 && luhn(digits);
}

/** raw_data with every sensitive key or value removed. Returns the cleaned object and how many were removed. */
export function dropSensitive(raw) {
  const out = {};
  let removed = 0;
  for (const [k, v] of Object.entries(raw || {})) {
    if (k.startsWith("_")) {
      out[k] = v; // the tracker's own markers (_source, _form_id...)
      continue;
    }
    const phoneLike = /phone|mobile|tel|fax/.test(normalizeKey(k));
    if (isSensitiveName(k) || isSensitiveValue(v, phoneLike)) {
      removed++;
      continue;
    }
    out[k] = v;
  }
  return { raw: out, removed };
}
