# URL state: what lives in the address bar

Added 2026-10-06. One rule, one hook (`lib/urlState.ts`), every key listed
here. Update this file whenever a page gains or loses a key.

## Why the URL

State that describes *what a person is looking at* (search, filters, date
ranges, selected tab, selected session) belongs in the address bar:
- a refresh keeps the view;
- back and forward work;
- a link opens the exact view, so support and teammates can look at the same thing;
- nothing is stored in the browser, so nothing goes stale there.

State that is a personal preference (a tile's time window, debug logging)
stays in `localStorage` (`mds/local_cache_schema.md`, section 3c). Data caches
stay in `localStorage` too.

## The rules (enforced by `useUrlState`)

1. Only values that differ from the default are written, so the plain page
   has a clean URL.
2. Changes use `router.replace` (no history entry per click or keystroke)
   and never scroll.
3. Unknown params are left alone: other features may own them.
4. Values are strings. A page parses them and falls back to the default
   when the value is not one it knows (`oneOf`), so a hand-edited URL can't
   break a page.
5. Text boxes commit after a 300 ms pause (`useDebouncedUrlText`).
6. A client component that reads the URL is wrapped in `<Suspense>` by its
   page.

## Keys

### `/platform/leads` (`components/leads/LeadsTable.tsx`)

| Key | Values | Default |
|---|---|---|
| `q` | search text (name or email) | empty |
| `date` | `all`, `today`, `custom` | `all` |
| `from`, `to` | `YYYY-MM-DD` local days (with `date=custom`) | last 7 days when custom is first chosen |
| `qualify` | `all`, `qualified`, `junk`, `unreviewed` | `all` |

Example: `/platform/leads?q=anna&date=custom&from=2026-10-01&to=2026-10-07&qualify=unreviewed`

### `/platform/conversions`

| Key | Component | Values | Default |
|---|---|---|---|
| `view` | `ReachConversionsSection` | `separate`, `split`, `merged` | `separate` |
| `range` | `ConvertedLeadsExplorer` | `3d`, `7d`, `30d`, `all`, `custom` | `all` |
| `from`, `to` | `ConvertedLeadsExplorer` | local date-times `YYYY-MM-DDTHH:mm` (with `range=custom`) | last 7 days when custom is first chosen |
| `page` | `ConvertedLeadsExplorer` | page number | `1` |

Changing the range resets `page` to 1.

### `/platform/leads/[lead_id]` (`components/leads/LeadSessionExplorer.tsx`)

| Key | Values | Default |
|---|---|---|
| `session` | a session id from this lead's session history | the latest session |

### `/platform/hook` and `/dev/hook` (`components/hook/HookWorkspace.tsx`)

| Key | Values |
|---|---|
| `q` | the whole query, JSON in base64url (names and layout included). Older query versions are upgraded on load (`jh-hook/migrate.ts`) |

The query never carries a site: whoever opens the link runs it against
their own current site.

## Deliberately not in the URL

| State | Why |
|---|---|
| each dashboard tile's window (24h / 7d / 30d / All) | a personal preference, remembered per browser (`jh_tile_window_*`), and a dashboard URL carrying five windows would be noise |
| Visits over time options (window, Unique visitors, Split by) | a quick exploration control; revisit if people ask to share it |
| the range pickers of New Reach and Conversions | two independent charts would need a key pair each; revisit with saved views |
| the main chart's interval, zoom and pan | live, continuously changing state |
| which frame is selected inside a session replay | a frame id means something only inside one timeline; the session itself is in the URL |

## Adding a key

1. Pick a short, lower-case name and a default.
2. `const [url, setUrl] = useUrlState({ key: "default" })`.
3. Parse with `oneOf` (or a number guard), and wrap the page's component in `<Suspense>`.
4. Add the key to the table above.
