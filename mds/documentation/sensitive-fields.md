# Sensitive fields - developer reference

Added 2026-10-14. Public page: `/docs/concepts/sensitive-fields` (`app/docs/concepts/sensitive-fields/page.tsx`).

## Why

The tracker stores the values of a submitted lead form (`form_submissions.raw_data`) so the site owner sees the lead. Before this change it stored every filled field except passwords, so a form with a card number, a bank account or an identity number put those into our database. Holding such data makes us subject to much stricter rules (card data falls under PCI DSS; identity numbers and health data are special or high-risk categories under GDPR and US state law) and serves no purpose for a lead tool. Jellyhook is a processor of the site owner's data; storing less is the simplest protection.

## The rules (same in the browser and on the server)

A field's value is left out of `raw_data` when any of these holds:

| Rule | Where | Detail |
|---|---|---|
| `autocomplete` starts with `cc-` | browser only (needs the element) | `cc-number`, `cc-csc`, `cc-exp`, ... |
| `type="password"` | browser | as before |
| a sensitive WORD in the name, id, placeholder, aria-label or label text | browser; on the server the raw_data key | normalized (lower case, spaces/dashes/dots to `_`) and matched as a whole word between `_`: card numbers, CVV/CVC/CSC, card expiry, IBAN, BIC/SWIFT, routing, sort code, account number, bank account, SSN, social security, SIN, NINO, national insurance, national id, passport, tax id, TIN, ITIN, EIN, PIN, password. Whole-word matching keeps `spinner`, `opinion`, `cc_email`, `vat_number`, `card_holder_name` and `account_manager` |
| the VALUE is a card number | browser and server | 13 to 19 digits (spaces or dashes allowed) passing the Luhn check. Skipped for phone fields (`type="tel"`, or a name like phone/mobile/tel/fax) and values starting with `+` |
| the VALUE is a US SSN | browser and server | `^\d{3}-\d{2}-\d{4}$` |
| `data-jh-ignore` on the field or an ancestor inside the form (or on the form) | browser | the field is excluded from EVERYTHING via `fieldAllowed()`: raw_data, engagement timings, the field list, validation errors; and from name/email/phone detection |

A field recognised by the automatic rules (not `data-jh-ignore`) keeps its engagement TIMING (no value is ever in engagement data), so drop-off at the card field stays visible.

## Code

| File | What |
|---|---|
| `public/tracker.js` | shared scope (next to `jhState`): `SENSITIVE_RE`, `sensitiveKey`, `luhnOk`, `sensitiveValue` (shared by the generic and the HubSpot capture). Forms section: `isSensitiveInput` (adds autocomplete, password, label text), `isIgnored`, `fieldAllowed` now returns false for ignored fields, `buildRawData` skips sensitive inputs, the email/name/phone extractors skip ignored fields. HubSpot section: `hubSpotSafeFields` filters the name/value pairs HubSpot reports |
| `lib/tracking/sensitive.js` | the server copy: `isSensitiveName`, `isSensitiveValue`, `dropSensitive` (keeps keys starting with `_`, the tracker's own markers) |
| `app/api/track-form/route.js` | `cleanRaw` ends with `dropSensitive`; logs only a count of removed fields, never values |

Keep the word list and the value rules identical in the tracker and `lib/tracking/sensitive.js`.

A bug found while building: the helpers were first placed inside the generic form section, which the HubSpot capture cannot see (separate function scope), so every HubSpot submission threw and was lost. The form compatibility suite caught it (3 HubSpot cases failing); the helpers moved to the shared scope and the suite passed again (54 of 54).

## Tests

- `lib/tracking/tests/sensitive.test.ts` (46): every sensitive name, the false-positive guards, card and SSN values, phone numbers never treated as cards, `dropSensitive`. Runs in `npm run test:forms`.
- `scripts/tracker-e2e/sensitive.js` (real Chrome): a form with a card number (by name), a CVC (by `autocomplete` only), an IBAN (by label only), an SSN typed into a notes field (by value) and a `data-jh-ignore` field. The lead keeps name, email, company and message; none of the other values appears in ANY request; the ignored field has no timing and is not in the field list; the card field keeps its timing.
- Regression: `scripts/tracker-e2e/forms.js` 54/54, `formsignals.js`, `formview.js`, `formaway.js`, `run.js` all pass; `test:tracking` 103.

## Limits

- Recognition depends on names, labels and value patterns: a field named `field_12` with no label whose value is not card- or SSN-shaped is not recognised. The site owner marks it with `data-jh-ignore`.
- Health or other special-category answers are not recognised automatically (their wording varies too much); `data-jh-ignore` is the tool.
- Payment fields inside a payment provider's iframe (Stripe, PayPal) are never visible to the tracker.
- Rows stored before 2026-10-14 are not cleaned. A one-off cleanup of old `raw_data` can be written on request (it would apply `dropSensitive` to existing rows).
