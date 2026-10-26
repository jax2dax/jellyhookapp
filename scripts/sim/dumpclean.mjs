// scripts/sim/dumpclean.mjs
// Makes the text of a `pg_dump --schema-only` of the production database runnable in another Supabase project's SQL
// editor (used by scripts/sim/bench-schema.mjs). Removes what the editor or a fresh project rejects:
//   - psql meta-commands (lines starting with a backslash, such as newer pg_dump's \restrict and \unrestrict)
//   - CREATE SCHEMA public (every Supabase project already has it)
//   - SET transaction_timeout (only exists in PostgreSQL 17 and newer)
// Everything else is kept as dumped. Pure; tested by scripts/sim/selftest.mjs.
export function cleanDump(text) {
  const out = [];
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (line.startsWith("\\")) continue;
    if (/^CREATE SCHEMA public;\s*$/i.test(line)) continue;
    if (/^SET transaction_timeout\b/i.test(line)) continue;
    out.push(line);
  }
  return out.join("\n");
}
