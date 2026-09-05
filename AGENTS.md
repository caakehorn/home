# For an agent picking this repository up

Vendor-neutral entry point. `CLAUDE.md` is the standing instruction for
building here and applies to every agent regardless of which one loads it
automatically — read it. This file says only where the *current* work is and
how to take a piece of it without colliding with somebody else.

## The work in flight: the charts overhaul

Almost every chart the site drew from wiki-brain was wrong — 194 of 239
auto-drawn tables carried a named defect. `docs/CHARTS.md` is the account: what
was wrong, measured; what is being built; and how several sessions run at once.

**Run this first. It is one command and it answers "what should I do".**

```
node scripts/charts-work.mjs          # every lane: done, held, blocked, open
node scripts/charts-work.mjs next     # the one to take, and why
```

Then, in order:

```
node scripts/charts-work.mjs claim <lane>
git checkout -b <something>/<lane>
git commit -am "Claim the <lane> lane" && git push -u origin HEAD
```

Push the claim **before writing code**. A claim nobody else can see is not a
claim, and the next session to run `next` will hand your lane to somebody else.

## Before every push

```
node scripts/charts-work.mjs check     # did this branch write another lane's files?
node scripts/audit-charts.mjs --check  # did any chart defect count go up?
npx tsc -b --noEmit && npm run build
```

`check` fails if your branch writes a path another lane owns. That is a guard,
not a suggestion: it fires before the push, where the fix is to split a commit,
rather than after it, where the fix is a merge.

## If you are stopping part-way

`node scripts/charts-work.mjs release <lane>`, push what you have, and say in
the PR what is stubbed. A half-finished lane that is pushed and released is
recoverable by anyone. A half-finished lane held by a session that has gone
away blocks it for twelve hours.

There is no `done` command, deliberately. A lane leaves the list when the thing
it describes is true — the payload exists, the instrument's own `entry.ts` says
`LIVE` — never because somebody said so. A list that can be ticked
independently of the thing it describes is a list that can lie.

## Two rules worth knowing before you touch a chart

**THE RULE**, stated in full at the top of `src/leviathan/core.ts`: every
number is a count, a date or a length, taken over the whole corpus with nothing
excluded and nothing weighted. No sentiment scoring, no keyword lists, no
threshold chosen for what it would surface. Ten instruments are barred under it
and stay barred.

**A chart must earn its axis.** The defect this whole overhaul exists to fix is
an analyzer that asked whether a chart was *possible* and never whether it was
*true*. Units are per column, not per table. A column of years is an axis, not
a magnitude. A `Metric | Value` list has no shared dimension and does not get
one.
