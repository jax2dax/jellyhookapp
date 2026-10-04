# Hook: data flow

How a query travels, how one engine hands data to another, and what is
cached.

## One run

```
browser (/dev/hook)
  state = the spec; mirrored into the URL as ?q=<base64url JSON>
  "Run hook" -> runHookAction(spec)                         server action
server
  site = current site from the cookie; requireSiteAccess     never from the browser
  runHook(pgHookDb, site, spec, {maxCredits})
    1 validate                                               no SQL yet
    2 type-check the output
    3 tunnels: ONE statement computes every sub-hook          -> value, or count + first 10
    4 estimates: EXPLAIN each top-level condition alone       parallel, cached 5 min
    5 order + strategy                                        auto / manual + guard
    6 compile final SQL; EXPLAIN it -> credits; gate
    7 execute
  -> { answer, plan, cost, tunnels, timing, sql }
```

Statements per run: 1 for tunnels (only if any), 1 EXPLAIN per top-level
condition (usually cached on re-runs), 1 EXPLAIN of the final SQL, 1
execution.

## The tunnel: how one engine's output enters another

A value in any condition can be `{ hook: <a complete spec> }`. That sub-hook
is a full engine run with its own entity, conditions and output.

```
main:  page views  where  visitor  is any of  ( sub )
                                               |
sub:   the values of "visitor id" of leads where name contains "hanna"
                                               |
WITH t1 AS MATERIALIZED (SELECT DISTINCT b.visitor_id AS v FROM leads b WHERE ...)
SELECT count(*) FROM page_views b WHERE b.visitor_id IN (SELECT v FROM t1)
```

- The data never leaves Postgres between engines: the sub-hook's output is a
  materialized CTE that the parent reads. A tunnel carrying 50,000 ids is
  still one statement, computed once.
- **Shape contract:** a sub-hook outputs either one value (`count`, `how
  many different`, a measure) or a list (`ids`, `values`). One value fits
  any single-value operator (`(SELECT v FROM t1)`); a list fits only "is
  any of" (`IN`) / "is none of" (`NOT EXISTS`). A list into a single-value
  operator is an error that names both sides.
- **Type contract:** the sub-hook's output type must equal the field's type,
  and id kinds must match (`ref` in `schema.ts`): visitor ids feed visitor
  fields, session ids feed session fields, page paths feed page fields.
- **Nesting:** a sub-hook can contain sub-hooks. They are emitted earlier in
  the same `WITH` list. Depth is capped (validate.ts) so nobody can build a
  cost bomb by recursion.
- **What the parent sees:** before the main query, every sub-hook directly
  in the main conditions runs once in a single statement and is reported
  (`tunnels`: path, what it is in English, one value or count plus the
  first 10). This is what lets a later chart know "the visitors this was
  about" without recomputing them.

## Inside one engine: steps

Top-level conditions are steps. Each is a predicate over the entity's rows
(alias `b`); groups and related-row conditions are one step each.

```
fused:   SELECT <output> FROM <entity> b WHERE p1 AND p2 AND p3
staged:  s0 AS MATERIALIZED (SELECT key FROM <entity> b WHERE p_first)
         s1 AS MATERIALIZED (SELECT key FROM s0 JOIN <entity> b ON key = s0.k WHERE p_next)
         SELECT <output> FROM s_last JOIN <entity> b ON key = s_last.k
```

Keys: page views and leads by `id`, sessions by `session_id`, visitors by
`id`, pages by path, away gaps by the page view that opened them.

## Related rows

`related` conditions run a correlated subquery per candidate row:

```
sessions where number of page views where page = /blogs and time on page > 5 sec >= 2
->  (SELECT count(*) FROM page_views c
      WHERE c.session_id = b.session_id AND c.page_path = '/blogs' AND c.time_on_page > 5000) >= 2
```

Joins between entities are defined once in `sqlmap.ts` (`joins`), on the
string ids the tracker writes (`session_id`, `visitor_id`, `page_path`),
not on uuids. Same convention as the rest of the app (`mds/database.md`).

## Caching

| What | Where | Lifetime | Why |
|---|---|---|---|
| step row estimates | server memory, per (site, SQL, values) | 5 min, 500 entries | the same step recurs while someone tweaks a query |
| value suggestions (pages, utm sources...) | none | per field, on first show | small grouped queries |
| results | not cached | | an answer must be live. Result caching is in plan.md |

No polling and no auto-run: a result is a snapshot of one run, and runs
happen only on "Run hook", because every run is metered.

## The URL

`?q=` holds the whole spec (JSON, base64url). It carries no site: the
person opening the link runs it against their own current site. A spec
from a URL is untrusted and fully validated and type-checked every run.
