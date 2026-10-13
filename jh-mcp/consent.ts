// jh-mcp/consent.ts
// The words a person agrees to when creating an MCP token. The VERSION is stored with the token (mcp_tokens
// .consent_version): change the wording => change the version, so it is always possible to say which text a given
// token was created under. The Settings screen and the server check both import this file; the server rejects a
// creation request that does not carry `consent: true`.
export const CONSENT_VERSION = "2026-10-13.1";

export const CONSENT_TEXT =
  "This token lets an AI app you connect (for example Claude or Cursor) read this site's Jellyhook data. The answers are sent to that AI provider. Emails, names and phone numbers are hidden unless you also tick the second box. I understand this, and I am allowed to share this site's data with that provider.";

export const PII_CONSENT_TEXT =
  "Also let this token see emails, names and phone numbers unmasked. These personal details will be sent to the AI provider of any app that uses this token.";
