# Main chart: sessions online over time

A TradingView-style chart on `/platform/dashboard` that answers one
question: **how many people were on the site at the same time, and when?**
It rises when a session starts and falls when a session closes, so a
business sees its busiest moments the way a trader sees price.

Further reading:

- [docs/architecture.md](docs/architecture.md): how it's built, what it costs, how to extend it
- [docs/data-flow.md](docs/data-flow.md): exactly which query runs when, and how data moves through the chart
- [docs/ui-ux.md](docs/ui-ux.md): layout, colors, interactions, and the design decisions behind them

---

## The x axis: time, cut into buckets

The x axis is wall-clock time in the viewer's own timezone. It's cut into
equal **buckets** of the selected **interval**: 5s, 10s, 30s, 1m, 5m, 15m,
30m, 1h, 4h or 1d (default: 10s).

- Buckets under an hour line up with the clock: 10:40:00, 10:40:10, 10:40:20...
- Hour and day buckets start on the viewer's local hour and local midnight,
  so "1d" means the viewer's day, not UTC's.

The interval decides the shape of the line. The size of the window you're
looking at never does. Picking 5s and looking at five months still means
5s buckets, as you specified for variety 1.

## The y axis: peak sessions online in that bucket

For each bucket, y is **the highest number of sessions that were open at
the same instant at any moment inside that bucket.**

A session counts as open from its `started_at` up to its `ended_at`. An
open session (`ended_at` still null) counts right up to "now".

Your own examples, run against the real code (both pass):

| Visit | Interval | Buckets | Why |
|---|---|---|---|
| 10:40 to 10:48 | 10s | 10:40 = **1**, 10:50 = **0** | in the 10:40 bucket; gone before 10:50 |
| 10:40 to 10:47 | 5s | 10:40 = **1**, 10:45 = **1**, 10:50 = **0** | still there during 10:45 |
| 10:41 to 10:44 | 10s | 10:40 = **1** | never crosses a tick, but was online inside the bucket |

The third row is the case where "peak during bucket" and "sampled at the
tick" disagree. You chose peak, so **no visit is ever invisible**, however
short it is or however wide the interval is.

Two more rules that follow from "people online at the same instant":

- Two visitors inside one bucket who never overlap (10:41 to 10:43, then
  10:45 to 10:48) give **1**, not 2.
- One leaving at exactly the moment another arrives is **1**, not 2.

Nothing is ever averaged.

## Two ways to look at it

**Live (variety 2).** The right edge is pinned to now and moves every
second. Drag left to travel back through history (loaded on demand). The
left edge stops at the site's first-ever session. Zoom with a trackpad
pinch or the +/- buttons; a normal scroll still scrolls the page. Panning
away from now un-pins it, and a "Now" button jumps back.

## Three line styles

| Style | Points | Between points | Use it to see |
|---|---|---|---|
| **Smooth** (default) | one per bucket, value = peak | a curve | exactly how busy each moment was, softly drawn |
| **Steps** | one per bucket, value = peak | held flat until the next bucket | exact values, nothing interpolated |
| **Trend** | only where the count **changed**, value = that bucket's average | a curve running from one change straight to the next | the overall movement; bumps only where many sessions arrive close together |

Trend is the one for your 2:30 am example. A session starts at 2:30 am,
and the next change (anyone arriving or leaving) is at 9:30 pm:

- Smooth and Steps sit at **1**, flat, all day, because 1 person really
  was online the whole time.
- Trend has a point at 2:30 am and the next one at 9:30 pm, and the line
  slowly travels from one to the other.

A quiet stretch becomes a gentle slope, and a burst of arrivals makes a
steep climb. Its values are averages (half a bucket online counts as
0.5), so a very short spike looks smaller in Trend than in Smooth or
Steps, which never hide anything.

## Markers

Things from other tables, drawn on top of the line without changing it.
Each one has a checkbox and starts off:

- **Conversions:** a yellow dot on the line for every form submission,
  on the next point after it. A form submitted at 10:43 on the 5s chart
  is marked on the 10:45 point. Several on the same point become one dot
  with a count. Hover for who.
- **Team joined:** a vertical line at the exact moment a teammate joined
  this site's workspace (`site_members`, using the time they accepted the
  invite). Hover for who.

Panning never reshapes the Trend line. Both of its ends are anchored on
real change points, even when those sit just outside the view, never on
the view's moving edges.

**Custom range (variety 1).** A fixed from/to window, any interval. A
window that reaches now keeps updating live.

## When the window is wider than the screen

5s buckets from May 6 to October 1 is about 2.5 million buckets, and the
plot is about 1,500 pixels wide. Instead of averaging them (which would
erase every bump), each pixel column is drawn as a **range**:

- the **highest** bucket value in that column (the line on top), and
- the **lowest** bucket value in that column (the solid fill underneath).

The lighter band between them is where the line went up and down faster
than one pixel can show. Those are your "sharp bumps". The chart says when
it's drawing this way, and how many buckets share each column.
