// jh-mcp/mask.ts
// Personal details are hidden from an AI app by default (plan.md section 5). A token created with "may see personal
// details" skips this. Pure functions; the rules are deliberately blunt: show enough to recognise a record the person
// already knows, never enough to contact someone.
import type { HookSpec } from "../jh-hook/types";

export function maskEmail(v: string): string {
  const at = v.lastIndexOf("@");
  if (at <= 0) return "***";
  return v[0] + "***" + v.slice(at);
}

/** "Halima Ahmed" -> "H. A.", "Halima" -> "H." */
export function maskName(v: string): string {
  const parts = v.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "***";
  return parts.map((p) => p[0].toUpperCase() + ".").join(" ");
}

/** Keeps only the last two digits. */
export function maskPhone(v: string): string {
  const digits = v.replace(/\D/g, "");
  return digits.length >= 2 ? "***" + digits.slice(-2) : "***";
}

export type PiiKind = "email" | "name" | "phone";
const MASKERS: Record<PiiKind, (v: string) => string> = { email: maskEmail, name: maskName, phone: maskPhone };

export function mask(kind: PiiKind, v: string | null | undefined): string | null {
  if (v === null || v === undefined || v === "") return null;
  return MASKERS[kind](String(v));
}

/**
 * When the query's own OUTPUT is a personal detail (the values, the groups or an aggregate of lead.name / email / phone),
 * which kind it is. The returned strings are masked unless the token allows personal details.
 */
export function piiOutputKind(spec: HookSpec): PiiKind | null {
  if (spec.entity !== "lead") return null;
  const out = spec.output as { kind: string; field?: string };
  if (out.field === "email" || out.field === "name" || out.field === "phone") return out.field;
  return null;
}
