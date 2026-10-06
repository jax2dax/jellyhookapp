# Hook: UI / UX

## Now: `/platform/hook` (product) and `/dev/hook` (test bench)

Both pages render the same `HookWorkspace`. The product page hides the SQL
and the Postgres cost, and never shows raw ids: lists of sessions, leads or
page views show how many were found until the results canvas ships. The
bench shows all of it. The layout is the builder on the left and the
**preview** (silhouette) in a sticky right column, which stacks under the
builder on narrow screens. The silhouette's own UI notes are in
`silhouette/`.

### The test bench

This is Joshua's bench for testing the engine. The real Hook page comes
later, behind authorization, and will reuse the same builder and server
action. Until then the bench runs against the signed-in user's current
site only.

```
Hook                                                  [Copy link] [</>]
  (</> opens: paste a query -> Load into builder / Show the current query here)

> [Untitled hook (click to name it)]                              [+ note]
  Show [the number of v] of [sessions v] where
  Returns (number) single value: a number (how many sessions)
  | ::  > [Name this condition]            (date and time)  [+ note]  Remove
  |       [started at] [after] (date and time) [time ago] 3 [day] ago  [a value I type v]
  |                                    <- dragged space, dashed guide ->
  | ::  > [Blog readers]                         (number)  [note]   Remove
  |       [count or total] [number of] [page views] [at least] (number) 2 where
  |       | ::  > ...  [page] [is] (text) /blogs
  |       | ::  > ...  [time on page] [more than] (duration) 5 [sec]
  |       [+ Condition] [+ Look at its... v] [+ Any of / none of]
  | ::  > [visitor id] [is any of] [the result of a sub-hook (tunnel) v]
  |       +- Sub-hook: a separate, complete hook. Its result flows in through a tunnel -+
  |       | > [Untitled sub-hook]                                                       |
  |       |   Show [a list of ... values] [visitor id] values of [form submissions]    |
  |       |   | ::  > [name] [contains] (text) hanna                                    |
  |       | Fits: what the sub-hook returns can flow into this slot.                    |
  |       +-----------------------------------------------------------------------------+
  [+ Condition] [+ Look at its... v] [+ Any of / none of]
  [Use this hook as a sub-hook...]
Reads as: the number of sessions where ...

Run order   [Auto | Manual]  [x] Let the engine step in if my order is much slower
[Run hook]
Result: the number / the list / a breakdown with bars
        credits, plan ms, run ms, one pass / step by step
        How it ran (steps with row estimates), notes
        Tunnels: what flowed in from sub-hooks
        For developers: the SQL it ran / The query
On-screen notices (top right): run done, failures with a reference, upgraded queries, loads, copies
```

## How it is built

- **One recursive editor.** `components/hook/HookBuilder.tsx`'s
  `SpecEditor` edits a whole hook. Connected rows nest a `ConditionList`
  for the connected entity, and a sub-hook nests a whole `SpecEditor`. That
  is why a sub-hook looks exactly like the main hook, inside a dashed box.
- **Everything comes from `schema.ts`:**
  - the field list, in labelled groups (`FIELD_GROUPS`);
  - the operators for each type;
  - the value editor for each type;
  - the measures allowed for each type;
  - the connections.

  A new field in the schema appears here with no UI change.
- **Type colours.** Each condition has a coloured left edge and a badge for
  the type it tests, and every value shows its type badge. The same colour
  means the same kind of value everywhere.
- **Returns line.** Every hook and sub-hook says what it returns, and
  whether that is a list or a single value.
- **Sub-hooks are the full engine,** with all six outputs.
  - The dashed box turns green ("Fits") or red with the reason: wrong type,
    wrong id kind, or a list fed into a single-value operator.
  - A list fed into a single-value operator gets a one-click fix, **Use "is
    any of" instead**.
  - The starting sub-hook is already chosen to fit its slot.
- **Use this hook as a sub-hook...** wraps the whole current hook into a
  new one. It lists every slot the result fits (`slotsFor` in `shape.ts`),
  with matching ids first.
- **Names, notes, collapse.** Every hook, sub-hook and condition has an
  inline name, a **+ note** description, and an arrow that collapses it to
  one line (name, or a plain-English summary).
  - All of this is stored in the query (`meta`, `ui`), so saved hooks in
    the database will keep it with no change here.
  - The limits are 80 characters for a name and 500 for a description.
- **Vertical space.** The dotted handle on each condition drags open space
  above it. It snaps to 4 px, goes up to 480 px, works with arrow keys
  (16 px steps), and double-click resets it.
  - While dragging, only the spacer's height changes, at most once per
    frame, with no React render. The query is updated once, on release.
  - Horizontal layout stays fixed on purpose.
- **Value suggestions** for text fields come from the site's own data, most
  common first. If suggestions fail, the builder keeps working and the
  failure is logged.
- **Reads as:** the query in plain English under the builder, from
  `describe.ts`.
- **`</>`** in the header opens the code panel: paste a query to load it,
  or show the current one. It stays out of the way until it's needed.
- **Copy link** copies the URL, and the query lives in `?q=`. Older
  queries are upgraded on load, with a notice.
- **Notices.** Every event a person should know about is announced on
  screen, at most 4 at once, auto-dismissed, and readable by screen
  readers (`aria-live`). Errors stay longer.
- **Debugging** (`jh-hook/debug.ts`): `localStorage.setItem("hook:debug",
  "1")` in the browser, or `HOOK_DEBUG=1` on the server. Errors always log.
- **Run is explicit,** because every run costs credits.

Performance notes:
- The builder holds one state object, the query.
- Dragging does not re-render anything.
- Suggestion fetches are per field and cancelled on unmount.
- No polling.

## Where it is heading

1. **The output engine and the canvas: built** (`output/`). Results
   appear under the builder as numbers with a base rate, charts, session
   replays with the matched visits ringed, lead mini profiles, and visitor,
   page, form and field views. There is also a two-hook comparison. Next
   steps are in `output/plan.md`.
2. **The FramePlate silhouette sidebar** (right side). A faint, blinking
   FramePlate fills in as the hook is described:
   - plates appear as pages are mentioned ("4+" on a plate with no page
     chosen; hover to see the possible pages);
   - a yellow frame appears once "converted" is set;
   - dashed plates appear for "any page";
   - bulbs appear when a filter mentions them.

   Planned in `plan.md`.
3. **Dedicated Hook page** behind authorization, with the same action and
   builder.
4. **Saved hooks.** The query already holds names, notes and layout; the
   remaining work is plugging in a table.
5. **Cost before running:** "about 3 credits" shown on Run.
6. **A node / drag-and-drop editor.** It would be another view of the same
   query: every block already has an id, a name and a layout.
7. **Animated tunnels:** data visibly flowing from a sub-hook into its slot.
8. **Presets:** ready-made starting queries for common questions.

## Writing rules

- Product words only. A column name never appears: not
  `revisit_start_scroll_depth`, but "scrolled back up".
- Don't over-bundle. If a person might want to split a grouped idea, offer
  the parts, not one opaque switch.
- Every derived field says what is non-obvious in its hint.
- Names follow `naming.md`. Field reference: `reference.md` (generated).
- No em dashes in user-facing copy.
