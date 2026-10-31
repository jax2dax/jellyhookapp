// lib/admin/country.ts
// A session's country code (from the hosting platform's header, for example "DE") as a name: "Germany (DE)".
const names = new Intl.DisplayNames(["en"], { type: "region" });

export function countryName(code: string | null | undefined): string {
  if (!code) return "Unknown";
  try {
    const name = names.of(code.toUpperCase());
    return name && name !== code.toUpperCase() ? `${name} (${code.toUpperCase()})` : code;
  } catch {
    return code;
  }
}
