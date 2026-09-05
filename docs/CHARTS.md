# The charts

What the site draws from wiki-brain, what is wrong with it, and the order it
gets rebuilt in. Written 2026-09-05 against the snapshot at `public/wiki`
(498 pages) and the rack in `src/leviathan/core.ts` (46 instruments, 23 LIVE).

`node scripts/audit-charts.mjs` re-measures everything asserted in §1. It
carries the tally it was written against and `--check` exits 1 if any number
rises, so this document cannot quietly go stale.

---

## 1. What is actually wrong

### 1.1 The auto-charter — 194 of 239 drawn tables carry a hard defect

`src/wiki/Markdown.tsx:123` defaults to `tables = 'chart'`, so
`src/wiki/table.ts:analyzeTable` gets a vote on every table in the corpus and
draws whichever one it can find a numeric column in. Over the snapshot:

**663 tables → 239 auto-charted → 194 carrying at least one named defect.**

| defect | n | what the reader is shown |
|---|---|---|
| `truncated-labels` | 131 | `Chart.tsx:143` cuts a bar's category at 15 characters |
| `kv-list` | 54 | a `Metric \| Value` list flattened onto one shared axis |
| `tiny` | 39 | a two- or three-row chart |
| `blank-header` | 36 | no axis name, no series name |
| `year-as-value` | 27 | a year scraped from a prose cell, drawn as a magnitude |
| `mixed-magnitude` | 18 | series ≥100× apart sharing one axis |
| `unit-contamination` | 16 | `%` sniffed from one column, printed on all of them |
| `judgement-column` | 12 | a Score, Rating, Percentile or Gini charted |

Four that show the mechanism:

- **`health/cocaine`** — the table is `Node | Era | Role | Product specificity`.
  `parseNumber` takes the leading integer of `"2015–16"`, so the chart draws a
  bar 2,015 units tall and labels it with a person's page. A span of years is
  an axis; drawn as a magnitude it asserts that somebody's era is a quantity.
- **`health/intake-ledger`** — the `When` column holds `2026-08-30 20:05`,
  which parses to `2026` and stands twenty thousand times taller than the
  `Quantity` bars beside it (`0.1 g`). Every category label reads `#1`.
- **`interests/favorites/eclecticism`** — `unitOf` finds `(86.7%)` in a
  parenthetical two columns over and sets the unit for the whole table, so
  **120 books renders as `120%`**. 105,405 messages share the axis with 25
  works of art.
- **`interests/favorites/books/want-to-read`** — "Total titles 149" and
  "Average rating 4.11" on one scale. The 4.11 bar is three pixels. The fourth
  row is a book title and parses to `null`.

The common cause is that `analyzeTable` is written to say yes. It asks whether
a chart is *possible*, never whether it is *true*.

### 1.2 One defect that is *not* here, recorded so it is not re-found

`marked` splits a table row on unescaped `|`, and the wiki's link syntax is
`[[path|label]]` — which reads like 43 tables rendering a column right of where
they belong. It is not: `src/wiki/Markdown.tsx:116` runs `preprocess` before
`marked.lexer`, and `src/wiki/inline.tsx:15` has already turned every wikilink
into `[label](/wiki/slug)` by the time the lexer sees the row. The columns
align.

It is written down because the first pass of this audit lexed the page bodies
raw, "found" the shift, and had it for twenty minutes. Any tool that reads
`public/wiki/pages/*.json` must run `preprocess` first or it is measuring a
corpus the site never renders.

### 1.3 THE RULE is enforced on the rack and not on the renderer

Seventeen instruments are `BARRED` in `core.ts` for keyword lists and composite
scores. Two things running by default on every wiki page do exactly that:

- `src/wiki/brief.ts:438` — `FLAGS` maps a keyword list
  (`closed|terminated|severed|collapsed|deceased` …) to four sentiment tones,
  `critical` / `serious` / `warning` / `good`, and paints them on the brief.
  That is THE POLYGRAPH's offence, shipped.
- `src/wiki/brief.ts:417` — `figureScore = label word count + 2 if the value
  contains one of ,+%$ + 1 if longer than three characters`, deciding which
  four numbers get set large. A threshold chosen for what it surfaces.

### 1.4 Eleven of the 23 LIVE instruments measure the repository, not the man

MASS (words per domain), CHRONICLE (commit prefixes), GENESIS and ACCRETION
(page count over commits), WEB and HEALTH (link degree), SCHEMA (frontmatter
fields), TAGS, ECHO (Jaccard between pages), ATTENTION (words against
mentions), EVIDENCE (citations), CLAIMS (sentences naming pages).

Every one is honestly built and none is being deleted. The defect is framing:
"people is the heaviest domain" is a fact about **how much has been typed**,
and it is presented in the same rack, with the same authority, as THE CLOCK's
message timestamps. They move to a wing named for what they measure.

### 1.5 Two instruments are sealed on a false premise, and THE ATLAS invents data that exists

| instrument | its `needs:` says | wiki-brain actually holds |
|---|---|---|
| THE SIGNAL | *the watch history, which is not vendored here* | `raw/self/youtube-watch-history/` — **19,068 parsed timestamps, 2010 → 2026-07**, 21,734 watch links, 11,797 channel links |
| THE SHELF | *the ratings export, which is not vendored here* | `raw/self/favorites/FAVS MASTERLIST.csv` — 2,016 rated works with dates added and read |
| THE ATLAS | prints `RECONSTRUCTED` on every frame | `raw/self/location/2026-06-22-ingest/` — a real Google Semantic Location History, **2014–2024**, plus a 28 MB `Records.json` |

`scripts/build-atlas.mjs:35` already documents the escape hatch: handed a real
export it sets `source: "export"` and the instrument stops printing
`RECONSTRUCTED`. It has never been fired.

The precedent for closing all three is `docs/CORPUS.md` and wiki-brain's
`CLAUDE.md` §7: a payload derived from a repository this one does not vendor is
**built and committed**, exactly as `atlas.json`, `ask.json` and
`accretion.json` already are.

### 1.6 Corpora that are dated, RULE-clean, and charted nowhere

| corpus | size | span |
|---|---|---|
| YouTube watch history | 19,068 dated watches · 11,797 channel links | 2010 → 2026-07 |
| Google location history | Semantic Location History + 28 MB of raw points | 2014 → 2024 |
| ChatGPT export | 375 conversations · 4,821 nodes | 2022 → 2025 |
| Gemini activity | 21 MB of dated activity | — |
| Twitter archive | 2,741 posts with platform-recorded counts | 2008 → 2026 |
| Facebook export | posts, reactions, events, groups, friends, searches | a decade |
| Concert record | 58 shows | 2001 → |
| `bin/text-metrics` | turn length, reply latency, hours, silence response | 2015 → 2026 |

---

## 2. The rebuild

Eight lanes, meant to run as several sessions at once. Every lane leaves
`npx tsc -b --noEmit` and `npm run build` clean, per `CLAUDE.md` §1. §3 is how
the lanes stay out of each other's way; this section is what they contain.

| lane | what it closes |
|---|---|
| `foundation` | the three shared files every new instrument has to edit |
| `analyzer` | §1.1 |
| `brief` | §1.3 |
| `youtube` · `location` · `sessions` | §1.5, §1.6 |
| `rewing` | §1.4 |
| `directive` | §1.1, in wiki-brain |

`node scripts/charts-work.mjs` prints which of them are done, held and open.

### `analyzer` — the analyzer refuses by default

`analyzeTable` is rewritten to ask whether a chart is *true*, and a table is
rendered as a table unless it passes. The rules, each one a defect from §1.1:

- units are detected **per column**, never per table; mixed units are separate
  charts or no chart
- a column whose values are all plausible years or dates is refused
- duplicate labels are refused
- fewer than four rows is refused
- a magnitude spread over 25× is refused without an explicit log opt-in
- a header matching score / rating / rank / percentile / index / verdict /
  grade / confidence is refused outright — THE RULE
- `Metric | Value` shapes render as a stat list with no shared axis
- labels wrap; nothing is truncated

Wiki-brain pages opt a table in with a directive above it, so a chart is
something a page **asked for** rather than something that happened to it.

`Markdown.tsx:11`'s own comment already records a third instance of this class:
the generation table on `fayette-return` "lost Who, Left for, Ended up and
Buried" to `Chart`'s TABLE face, "and drew birth years as bar lengths besides".
That was worked around by turning charts off in the Reader's Digest edition.
This checkpoint fixes the cause instead, so the workaround can go.

### `youtube` → `location` → `sessions` — the order the corpora land in

**YouTube first** (19,068 watches, sixteen years): volume by month against the
coverage gaps, hour-of-day by year, distinct channels and top-channel share per
year, repeat-watch distribution.

**Location second**: `RECONSTRUCTED` comes off THE ATLAS, and the real export
adds radius-from-home per day and transit distance and duration by year — both
lengths, both RULE-clean.

**AI sessions third**: conversations per week 2022–2025, turns per
conversation, and the hour-of-day profile of the sessions set against the
message record's own — two counts on one axis, which is the only kind of
comparison this site is allowed to draw.

### `foundation` — what every chart owes

One primitive, and it refuses rather than warns: a unit per series or it does
not draw; the `n` printed on every rate; a method note in the frame the way
`Frame.tsx` already gives every instrument; no truncated labels; touch parity
per `CLAUDE.md` §5. `scripts/audit-charts.mjs --check` joins `npm run
gates:check`, and every new payload asserts its published totals and
`process.exit(1)`s on drift, per `build-atlas.mjs`.


---

## 3. Running this as parallel sessions

Nothing below is etiquette. Every rule is a command that fails.

### 3.1 What a session does, in order

```
node scripts/charts-work.mjs          # what is done, held and open
node scripts/charts-work.mjs next     # the lane to take, and why
node scripts/charts-work.mjs claim <lane> --as "<your model>"
git commit -am "Claim the <lane> lane" && git push   # before writing any code
```

A claim nobody else can see is not a claim. Push it first, on a branch named
for the lane, and the next session to run `next` will route around you.

Before every push, and again before opening the PR:

```
node scripts/charts-work.mjs check    # did this branch write another lane's files?
node scripts/audit-charts.mjs --check # did any chart defect count go up?
npx tsc -b --noEmit && npm run build
```

`--as` is not decoration. It is how a session that finds a stale claim twelve
hours from now can tell whether the session holding it was its own.

### 3.2 Why `foundation` runs alone and first

Adding one instrument today edits three shared files — the `INSTRUMENTS` array
in `src/leviathan/core.ts`, and an import plus a `BUILT` entry in
`src/routes/Leviathan.tsx`. Three sessions adding three instruments collide
twice each, in files where a bad merge silently drops an instrument rather than
failing to compile.

`foundation` removes the collision instead of scheduling around it. An
instrument becomes one self-contained directory:

```
src/leviathan/instruments/signal/
  entry.ts        the registry record — id, wing, corpus, method, status
  Signal.tsx      the component
  signal.css
```

discovered with `import.meta.glob`, so **adding an instrument is a new
directory and never an edit to a shared file.** `scripts/build-all.mjs` does
the same for the payload builders, so a new one is a new script rather than a
line in `package.json`. After that lands, five lanes can run at once with a
disjoint file set each.

`brief` does not wait, because it touches nothing anyone else touches.

### 3.3 How two sessions are kept apart

Each lane declares the paths it **owns** in `scripts/charts-work.mjs`.
`charts-work.mjs check` reads the branch's own diff against `origin/main` and
exits 1 if it writes a path another lane owns, so the guard fires **before**
the push, where the fix is to split a commit, rather than after it, where the
fix is a merge. Communal and exempt: `docs/`, `.charts/`, the two work tools,
`package.json`, `CLAUDE.md` and `AGENTS.md`.

Two patterns can match one path — `foundation` owns every instrument's
`entry.ts`, because splitting the registry is what that lane *does*, while
`youtube` owns everything under its own instrument directory. The more
specific pattern wins, specificity being how far a pattern commits to a path
before its first wildcard. `charts-work.mjs doctor` probes every tracked file
plus the paths the unbuilt lanes will create, and **exits 1 if any path is
matched by two lanes at equal specificity** — so "disjoint by construction" is
a thing the tool proves on demand rather than a thing this document asserts.
It caught a real overlap the first time it ran.

### 3.4 The claim ledger is append-only, on purpose

`.charts/lanes.jsonl`. One JSON object per line — `claim`, `release`,
`complete` — and the state is projected from the log rather than stored.

This is the shape wiki-brain uses for `intake/`, `testimony/` and
`skills/registry/`, for the reason given there: several sessions push from
several branches, and two appends merge as a set union, where one mutable file
would make every concurrent push a conflict whose loser is dropped silently.
Delete the file and nothing but the claims is lost; every lane's *done* state
is recomputed from the tree.

A claim with no `release` after twelve hours reads as **stale and
reclaimable** — a session whose container was reclaimed leaves no release
behind, and would otherwise hold a lane forever.

### 3.5 What a session owes the next one

There is no `done` command, deliberately. A lane leaves the list when the thing
it describes is true — `signal.json` exists and the instrument's own `entry.ts`
says `LIVE` — not when somebody says so. So the handoff is not a status report:

- **Push the branch and open the PR at the first checkpoint**, per `CLAUDE.md`
  §1, with the lane named in the title. An unpushed branch is work nobody can
  find.
- **Release the lane if you stop mid-way** (`charts-work.mjs release <lane>`),
  and say in the PR what is stubbed. A half-lane pushed and released is
  recoverable; a half-lane held by a dead session blocks it.
- **Leave the numbers checkable.** A payload asserts its published totals and
  `process.exit(1)`s on drift, per `build-atlas.mjs`; `audit-charts.mjs`'s
  `BASELINE` is lowered as counts actually fall, and never raised to go green.
- **Write down what cost you an hour**, in this file. §1.2 exists because the
  first pass of the audit lost twenty minutes to a defect that was not real.

### 3.6 For a model that is not Claude Code

Nothing here needs a particular vendor's skills, plugins or harness. The whole
protocol is six commands and a JSONL file:

| command | what it answers |
|---|---|
| `charts-work.mjs` | what is done, held, blocked, open |
| `charts-work.mjs next` | which lane to take, and why |
| `charts-work.mjs claim <lane> --as "<model>"` | take it |
| `charts-work.mjs release <lane>` | hand it back |
| `charts-work.mjs check` | did this branch write outside its lane? |
| `charts-work.mjs doctor` | is lane ownership still decidable? |

`AGENTS.md` at the repo root is the entry point for an agent that does not load
`CLAUDE.md` automatically; `CLAUDE.md` §9 points here for one that does. Both
say the same four things, so it does not matter which one a session finds.
