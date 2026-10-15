// lib/tracking/tests/sensitive.test.ts - offline. Run: npm run test:forms
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { dropSensitive, isSensitiveName, isSensitiveValue } from "../sensitive.js";

let fails = 0;
let passes = 0;
const ok = (c, m) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

for (const n of ["card_number", "Card Number", "cardnumber", "cc-number", "ccnum", "credit-card", "cvv", "CVC2", "security code", "card_expiry", "iban", "IBAN number", "routing_number", "sort code", "account_number", "bank_account", "ssn", "Social Security Number", "national-insurance-number", "passport", "passport_no", "tax_id", "Tax ID", "tin", "pin", "password"]) {
  ok(isSensitiveName(n), "sensitive name: " + n);
}
for (const n of ["email", "first_name", "company", "message", "phone", "account_manager", "spinner", "opinion", "pinterest_url", "vat_number", "cc_email", "card_holder_name", "postcode", "tinted"]) {
  ok(!isSensitiveName(n), "NOT sensitive: " + n);
}

ok(isSensitiveValue("4242 4242 4242 4242") && isSensitiveValue("4111-1111-1111-1111") && isSensitiveValue("378282246310005"), "card numbers (Visa, Visa with dashes, Amex) are caught by value");
ok(!isSensitiveValue("4242 4242 4242 4241"), "a 16-digit number failing the Luhn check is not a card");
ok(isSensitiveValue("123-45-6789"), "a US social security number is caught by value");
ok(!isSensitiveValue("+44 7911 123456") && !isSensitiveValue("4242424242424242", true), "phone numbers are never treated as cards");
ok(!isSensitiveValue("hello") && !isSensitiveValue("12345") && !isSensitiveValue(""), "ordinary values pass");

const { raw, removed } = dropSensitive({ email: "a@b.com", card_number: "x", notes: "4242 4242 4242 4242", ssn_field: "1", message: "Call me", _source: "hubspot", mobile: "4242424242424242" });
ok(removed === 3 && raw.email && raw.message && raw._source === "hubspot" && raw.mobile && !("card_number" in raw) && !("notes" in raw) && !("ssn_field" in raw), "dropSensitive removes card and ssn fields and card-number values, keeps the rest and the tracker's own markers");

console.log(`\n${passes} passed, ${fails} failed`);
if (fails) process.exit(1);
