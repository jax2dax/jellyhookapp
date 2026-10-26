// scripts/sim/envfile.mjs
// KEY=VALUE lines of an env file as an object: comments, blank lines, "export " and one pair of quotes around a value are
// handled. Used by scripts/sim/dev-bench.mjs instead of node's --env-file flag, because Next.js passes node's flags on to
// its own workers through NODE_OPTIONS, where --env-file is not allowed. Pure; tested by scripts/sim/selftest.mjs.
export function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).replace(/^export\s+/, "").trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) out[key] = value;
  }
  return out;
}
