# Silhouette developer guide, part 2: data flow

How the preview comes to life, with almost no code. For the code, see part
1 (`architecture.md`). For the drawing rules, see `rules.md`.

## The short version

```
someone edits the hook
   -> the hook (in memory) is turned into a picture description   (instant, no server)
   -> the picture is drawn in FramePlate's shapes and colours
   -> it pulses once; the parts that changed glow
```

Running the hook doesn't touch the preview. The preview shows the
question, not the answer.

## 1. What goes in

- **The hook itself.** Every edit produces a new hook, and the preview
  redraws from it.
- **The site's page addresses**, fetched once when the page opens. They are
  only used to label unknown pages ("12+") and to list them on hover. If
  that fetch fails, labels say "any" and nothing else changes.

Nothing else is read. There are no sessions, no times and no scroll data.

## 2. From hook to picture

1. **Which pictures:** the kind of thing the hook returns decides whether
   it gets a session picture, a single big page picture, both, or none.
   Leads with no session described get none.
2. **Gathering the description:**
   - every condition adds something: a yellow frame, a page address, a band
     of seen page, a purple away bar, a chip of text;
   - an "any of" group splits the picture into one per alternative;
   - an "exclude" group adds a red-hatched picture of what must not
     happen.
3. **Laying it out:**
   - the described pages are placed in order: landing first, exit last,
     "page number 3" third, "the pages after it" right after it;
   - ranges become solid plates for the minimum, faint "?" plates for the
     possible extras, and a "+" when there is no upper bound;
   - away bars go between pages.
4. **Sub-hooks:** each one is described the same way, smaller, under its
   own heading, saying where its result flows.

## 3. What each shape remembers

Every shape remembers:
- **its key:** stable from one edit to the next, so the preview knows
  which shapes changed;
- **its source:** which condition drew it.

Today the key drives the glow. Tomorrow (v3) the source lets a person
drag a band or a bulb in the preview and have Hook update exactly that
condition, and no other.

## 4. Pulse and glow

After each edit, the preview compares the new shapes with the previous
ones:
- the whole preview pulses once, briefly brighter, then back to faint;
- shapes that are new or different glow for a moment;
- shapes that didn't change stay still.

People who set "reduce motion" on their device get neither.

## 5. Failure handling

| What fails | What happens |
|---|---|
| the page list | labels say "any"; the preview works |
| turning the hook into a picture | a quiet message; the builder works |
| drawing | the preview pauses with a message, retries on the next edit; the builder works |

Every failure is logged as `[hook] silhouette ...`.

## 6. How it fits next to Hook

```
builder (left) --- hook ---> engine (on Run) -> result
     |
     +---------- hook ---> silhouette (right, live, sticky)
```

The silhouette and the engine read the same hook independently. Neither
depends on the other.
