// jh-hook/engine/sql.ts
// The only place SQL text for table access is produced, so tenant scoping
// is structural: every table reference goes through scoped(), which pins
// site_id = $1. $1 is ALWAYS the site id (see Params). A hook cannot name
// a table that isn't in TABLES, and cannot read a row of another site.

export const TABLES = ["page_views", "sessions", "form_submissions", "visitors", "form_engagement"] as const;
export type Table = (typeof TABLES)[number];

/** Positional parameters for ONE statement. $1 is reserved for site_id. */
export class Params {
  readonly values: unknown[];
  constructor(siteId: string) {
    this.values = [siteId];
  }
  add(v: unknown, cast: string): string {
    this.values.push(v);
    return `$${this.values.length}::${cast}`;
  }
}

export function scoped(table: Table, alias: string): string {
  if (!(TABLES as readonly string[]).includes(table)) throw new Error(`Unknown table: ${table}`);
  return `(SELECT * FROM public.${table} WHERE site_id = $1::uuid) ${alias}`;
}

/** Escapes LIKE wildcards so user text is matched literally. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (ch) => "\\" + ch);
}
