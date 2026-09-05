# `.charts/`

Coordination state for the charts overhaul. Two sessions may be writing here at
once, so read `docs/CHARTS.md` §3 before touching anything.

## `lanes.jsonl`

Append-only. One JSON object per line:

```json
{"type":"claim","lane":"youtube","at":"2026-09-05T17:04:11.902Z","agent":"session_…","model":"claude-opus-5","branch":"claude/charts-youtube"}
```

`type` is `claim`, `release` or `complete`. The current holder of a lane is
projected from the log — the last `claim` with no later `release` or `complete`
after it — rather than stored, so nothing in this file is ever rewritten.

**Never edit or reorder a line.** Two sessions appending to a log merge as a
set union; two sessions editing one mutable file make every concurrent push a
conflict whose loser is dropped silently. That is the same reasoning behind
wiki-brain's `intake/`, `testimony/` and `skills/registry/` ledgers.

**This file holds claims and nothing else.** Whether a lane is *done* is never
recorded here — it is recomputed from the working tree on every run, because a
list that can be ticked independently of the thing it describes is a list that
can lie. Delete `lanes.jsonl` and the only thing lost is who is currently
holding what.

A claim with no `release` after twelve hours reads as **stale and
reclaimable**: a session whose container is reclaimed leaves no release behind,
and would otherwise hold a lane forever.

## Use it through the tool

```
node scripts/charts-work.mjs                        # done, held, blocked, open
node scripts/charts-work.mjs next                   # the lane to take, and why
node scripts/charts-work.mjs claim <lane> --as "<model>"
node scripts/charts-work.mjs release <lane>
node scripts/charts-work.mjs check                  # is this branch inside its lane?
node scripts/charts-work.mjs doctor                 # is lane ownership decidable?
```
