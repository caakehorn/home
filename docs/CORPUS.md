# THE CORPUS — a data dictionary

**What this is.** Every structured payload in this repository: its exact shape, its
row counts, its enum distributions, and the traps that will silently corrupt a
build that reads it. It exists so that the next visualiser does not have to
re-derive any of this, and so that a build that finds a number here and a
different number in the data knows the snapshot has moved.

**Generated** from a full crawl of the repo at `main`. The wiki figures below are
the snapshot of **2026-08-30, 472 pages / 774,912 words**; the distribution tables
in §1.2 and §1.3 are older crawls and say so where they differ. The live counts
are always one command away, and are the thing to trust:

```
node -p "require('./public/core/structure.json').counts"
node -p "require('./public/wiki/index.json').counts"
```

**How to use it.** These numbers are a description of the corpus, not a contract
with it. Read them to know what shape a payload is and what it will do to a
pipeline; do not wire a build to require that they still hold.

That distinction was learned the hard way and is worth the paragraph.
`scripts/build-core.mjs` used to assert eight of the figures on this page for
exact equality, on the reasoning in §8 — and the corpus it describes is a wiki
somebody writes in every day, synced every five minutes. So an ordinary page edit upstream
turned the sync red, the snapshot froze, and the site went on deploying green
from a corpus that had stopped advancing: eight days of `wiki.json`, then 22 of
25 Reader's Digest twins, merged and never published. Worse, the remedy for
`words: got 772670, says 772653` was to type 772670, so the check taught everyone
who met it to clear it without looking.

**What a build should assert instead** — both of these, and neither of them is a
number anybody maintains:

- **Self-consistency.** Does the output agree with the input it was derived from
  in this same run? Node count against index rows against files on disk; a
  summed field against the count that claims to summarise it; every index in
  range. These hold on any corpus of any size and catch a truncated read the
  moment it happens.
- **Movement.** Has the corpus *collapsed* since the last build — measured
  against the last build's own committed output, so the baseline advances
  itself? Growth never fails. `build-core.mjs` is the worked example.

`scripts/build-atlas.mjs` still asserts published totals exactly, and correctly:
its source is a finished reconstruction that does not move. The difference is not
strictness, it is whether the thing being asserted is still being written.

---

## 0. Where everything lives

```
public/wiki/          472 page JSONs + index + gaps + sage + lexicon + assets
public/transcript/    index + 91 month files — 134,348 messages
public/leviathan/     10 derived instrument datasets
public/gallery/       manifest + 41 media files
public/agent/         generated at build time (gitignored)
public/art/           11 webp plates          public/ally/  5 photographs
public/gate/          two AES-GCM vaults — not data
src/content/          sections, art manifests, crawl copy, slogans
src/lineage/data.ts   a transcribed 515-person GEDCOM, reduced to 47
src/arcade/content.ts cabinet copy, star fields, constellation edges
```

---

## 1. The wiki snapshot — `public/wiki/`

### 1.1 `index.json`

Five top-level keys: `generatedAt`, `counts`, `domains`, `pages`, `edges`.

```
counts   { pages: 472, words: 774912, chartables: 121, briefs: 10,
           plain: 25, edges: 3801 }         // schema also allows `sealed`
domains  [{ id, count }] × 10
pages    [IndexEntry] × 472
edges    [[int, int]] × 3801                // undirected index pairs into `pages`
                                            // no self-loops, all 3801 distinct
                                            // build-core.mjs re-checks all three
                                            // properties on every build
```

`IndexEntry` — 14 keys, present on all 472 rows:

| field | type | notes |
|---|---|---|
| `slug` | str | `domain/path/name` |
| `domain` | str | 10 values |
| `title` | str | |
| `type` | str | 13 values (mirrors `page_type`) |
| `status` | str | 5 values |
| `knownFor` | str \| null | 165 non-null |
| `relationship` | str \| null | 173 non-null, 18 distinct |
| `words` | int | |
| `charts` | int | chartable-table count |
| `links` | int | outbound count; the array is on the page JSON |
| `brief` | bool | 10 true |
| `plain` | bool | 25 true |
| `x`, `y` | float | **precomputed 2-D force layout, baked at sync.** x ∈ [−0.8515, 0.7256], y ∈ [−1.0543, 0.9325] |

Optional `locked` exists in the schema for sealed pages — **0 in this snapshot**
(`wiki.locks.json` at the repo root reads `{ locked: [] }`).

**Graph shape.** 3,801 edges over 472 nodes. Highest degree:
`timeline/master-timeline` 360 · `meta/recent-activity` 220 · `people/index` 172 ·
`people/annie-ulmer` 165 · `meta/open-questions` 165 ·
`people/suzanne-frank` 88 · `meta/digest` 84 · `mind/index` 76 ·
`self/message-corpora/master-message-dump` 76 · `self/context-core` 69 ·
`mind/synthesis/totality-themes` 67 · `people/alexis-armel` 66.

### 1.2 `pages/*.json` — 472 files, 7.49 MB

Filename is the slug with `/` → `__`. **Every file carries the same 17 keys**
(verified across all 472 — one key set, no exceptions).

| key | type | population / shape |
|---|---|---|
| `slug` `domain` `title` | str | 472 |
| `meta` | dict | 472 — `Record<string,string>`, **all values stringified**, 23 distinct keys |
| `infobox` | dict \| null | **179 dicts / 293 null**, 39 distinct keys |
| `lists` | dict | 472 — `Record<string,string[]>`, 10 distinct keys. **Lossy for `connections`** |
| `fmRaw` | str | 472 — raw YAML front-matter verbatim, 107–27,973 chars. **The only lossless source of typed edges** |
| `h1` | str \| null | 470 / 2 — leading `# Heading`, stripped from `body` |
| `links` | str[] | 404 non-empty / 68 empty. **4,416 total**, min/med/max 0/5/359 |
| `body` | str | 472 — markdown with the H1 removed |
| `words` | int | min/med/max 12 / 699 / 113,514; total 774,912 |
| `charts` | int | 0–9; **121 total across 52 pages** |
| `brief` | bool | 10 true |
| `gaps` | dict[] | 151 pages non-empty; **484 entries**; each `{ text, label }` |
| `staged` | null | **null on all 472** (source is `meta.pending_ingest`) |
| `plain` | dict \| null | **25 dicts** — `{ title, body, words, readingLevel, against, stale }` |
| `backlinks` | str[] | 469 non-empty / 3 empty. **4,364 total**, min/med/max 0/6/160 |

#### `meta` key census (values are all strings)

> The populations in this census and in §1.3 are an **earlier crawl of a larger
> corpus** — the counts above 472 are the giveaway. They are kept because the
> shapes and the traps they name are what these two sections are for, and those
> have not moved. Re-crawl before quoting a population from either.

| key | pages | | key | pages |
|---|---|---|---|---|
| `domain` `page_type` `status` | 471 | | `date_range_end` | 162 |
| `date_created` `date_modified` | 512 | | `sources` | 146 |
| `tags` | 483 | | `aliases` | 102 |
| `knowledge` | 257 | | `importance` | 82 |
| `related` | 195 | | `date` | 7 |
| `title` | 184 | | `image` `image_caption` | 4 |
| `date_range_start` | 168 | | `date_range` | 3 |
| | | | `subject` | 2 |

Singletons: `synthesizes`, `note_on_sources`, `relation_type`, `connections`.

#### `infobox` key census — 179 pages, 39 distinct keys

`name` 178 · `relationship_to_dan` 173 · `known_for` 165 · `location` 111 ·
`first_contact` 99 · `sex` 75 · `handles` 38 · `role` 24 · `notes` 12 · `type` 9 ·
`aliases` 6 · `dob` 5 · `status` 5 · `subject_page` 4 · `partner` 4 · `mbti` 3 ·
`closed` 3 · `relationship` 3 · `outcome` 3 · `occupation` 2 · `parents` 2 ·
`period` 2, then 17 singletons.

Clean facets: `sex` (male 47 / female 27 / unknown 1) · `location` (15 distinct;
uniontown 52, nyc 31, remote 9) · `relationship_to_dan` (32 distinct, but
unknown 84 / friend 24 / acquaintance 14 / family 8 / ex-partner 7 / coworker 6 /
contact 4 / dealer 2 covers 149 of 173) · `handles` (38 pages, stringified JSON
arrays).

#### `lists` key census — value is always `string[]`

`connections` 403 · `sources` 361 · `related` 87 · `synthesizes` 79 ·
`changelog` 20 · `date_range_end` 5 · `journey` 3 · `tags` 2 · `chart` 1 ·
`date_range_start` 1.

### 1.3 Front-matter — the `fmRaw` census

All but one page parses as YAML. **The one failure:**
`mind/synthesis/august-grievance-verdict` — block-scalar syntax error at line 12.
**A YAML parser silently loses that page's 12 typed edges**; read the block by
line instead (`scripts/core-frontmatter.mjs`) and there is nothing to lose.

| key | pages | value type |
|---|---|---|
| `domain` `page_type` `status` | 518 | str |
| `date_created` `date_modified` | 511 | date |
| `sources` | 506 | `list[str]` 477, empty 29 |
| `tags` | 484 | `list[str]` 483, empty 1 |
| **`connections`** | **403** | **`list[dict]` 402, empty 1** |
| `related` | 282 | `list[str]` 179, empty 103 |
| `knowledge` | 256 | str |
| `title` | 183 | str |
| `infobox` | 179 | dict |
| `date_range_start` | 168 | date 165, str 2, null 1 |
| `date_range_end` | 166 | date 157, str 4, null 5 |
| `aliases` | 101 | `list[str]` 98, empty 3 |
| `importance` | 81 | str |
| `synthesizes` | 79 | `list[str]` 78, empty 1 |
| `changelog` | 20 | `list[{date, note}]` |
| `date` | 7 | date |
| `image` `image_caption` | 4 | str |
| `journey` | 3 | `{ stops: [{page, note}] }` |
| `date_range` | 3 | `list[str]` — 2-element `[start, end]` |
| `subject` | 2 | str (wiki path) |
| `chart` | 1 | a full explicit ChartSpec |
| `note_on_sources` `relation_type` | 1 | str |

#### Enum distributions

- **`page_type`** (13) — entity 291 · synthesis 60 · concept 38 · event 37 ·
  summary 20 · report 15 · profile 14 · index 13 · period 13 · note 7 · chat 6 ·
  journey 3 · dataset 1
- **`status`** (5) — stable 193 · active 182 · closed 100 · archived 31 · stub 12
- **`knowledge`** (3) — mixed 159 · earned 77 · derived 20
- **`importance`** (4) — high 48 · critical 23 · normal 7 · medium 3
- **`relationship`** (18) — unknown 84 · friend 24 · acquaintance 14 · family 8 ·
  ex-partner 7 · coworker 6 · contact 4 · dealer 2 + 10 free-text singletons

#### `tags` — 34 distinct, 1,384 assignments over 484 pages

digital-footprint 191 · relationships 144 · music-production 134 ·
uniontown-era 130 · personality-profile 94 · nyc-era 83 · ai-collaboration 76 ·
forensic-analysis 75 · addiction-recovery 74 · family 53 · career 47 ·
trauma-bond 46 · financial-stress 40 · politics 35 · legal 24 · grief 21 ·
mental-health 16 · ideology 15 · infidelity 15 · housing 14 · attachment 14 ·
physical-health 7 · pets 7 · behavioral-change 6 · boundaries 5 ·
non-monogamy 4 · intensity 3 · consistency 3 · future 2 · dui 2 · language 1 ·
taste 1 · vocabulary 1 · trust 1.

#### Dates

- `date_created` by month — 2026-06: 198 · 2026-07: 119 · 2026-08: 194
- `date_modified` by month — 2026-06: 28 · 2026-07: 157 · 2026-08: 326
- `date_range_start` on 167 pages; **160 have both ends**. Earliest `1892-01-01`.
  Some ends are the literal string `present`.
- Range-start years — 1892(1) 1961(1) 1962(1) 2000(2) 2005(1) 2007(4) 2008(3)
  2009(4) 2010(2) 2011(11) 2012(3) 2013(9) 2014(2) 2015(12) 2016(7) **2017(26)
  2018(22) 2019(17)** 2020(4) 2021(4) 2023(7) 2024(4) 2025(7) 2026(13)
- Ranges by domain — people 121 · timeline 25 · mind 6 · self 5 · places 4 ·
  work 3 · interests 2 · legal 1

### 1.4 Typed edges — the rarest thing in the corpus

**2,304 connections across 355 pages.** Every entry is `{ page, type, claim }`,
all three keys present, zero exceptions. `claim` is prose asserting *why* the
edge exists — length min/median/max **65 / 221 / 704** chars.

> **Two totals, and which one is right.** A YAML parser reaches **2,292** across
> 354 pages, because `mind/synthesis/august-grievance-verdict` throws on a
> block-scalar error at line 12 and takes its 12 edges with it. A line reader
> reaches all **2,304** across 355 pages, because the block shape is completely
> uniform: every item is indented exactly two spaces and **no value wraps onto a
> second line**, corpus-wide. `scripts/core-frontmatter.mjs` reads it that way
> and needs no YAML dependency and no fallback. The per-type table below is the
> line reader's — the parenthesised figure is what a YAML parse returns, and the
> difference is always those 12 edges.

**19 types, six inverse pairs, four symmetric, three unpaired:**

| type | n (YAML parse) | family | inverse |
|---|---|---|---|
| `co-occurs` | 330 | affinity | *(symmetric)* |
| `evidences` | 322 (319) | evidential | `evidenced-by` |
| `evidenced-by` | 317 | evidential | `evidences` |
| `contains` | 292 | structural | `component-of` |
| `component-of` | 292 (291) | structural | `contains` |
| `parallels` | 158 (157) | affinity | *(symmetric)* |
| `instantiates` | 138 (137) | structural | `instance-of` |
| `instance-of` | 137 (135) | structural | `instantiates` |
| `caused-by` | 82 (81) | causal | `causes` |
| `causes` | 79 | causal | `caused-by` |
| `contradicts` | 70 | tension | *(symmetric)* |
| `contextualizes` | 52 (50) | evidential | — |
| `mirrors` | 39 | affinity | *(symmetric)* |
| `precedes` | 35 | causal | `follows` |
| `follows` | 32 | causal | `precedes` |
| `supplies` | 10 (9) | evidential | `supplied-by` |
| `supplied-by` | 5 | evidential | `supplies` |
| `escalates` | 4 | causal | — |
| `resolves` | 4 | causal | — |

`family` is a grouping of the names the corpus already uses, added by
`scripts/build-core.mjs` to decide how an edge is drawn. It is not a judgement
about which edges matter.

The near-exact reciprocity of the paired counts (319/317, 292/291, 137/135,
81/79, 35/32, 9/5) means this is a **deliberately maintained bidirectional typed
graph**, not an accident of authoring.

**By source domain** — mind 888 · people 622 · interests 270 · timeline 264 ·
self 114 · places 80 · work 76 · health 46 · legal 26.
**By target domain** — mind 898 · people 625 · interests 264 · timeline 262 ·
self 114 · places 78 · work 71 · health 48 · legal 26.
**Top domain→domain flows** — mind→mind 527 · people→people 263 ·
interests→interests 183 · mind→people 147 · people→mind 145 · people→timeline 100 ·
timeline→people 99 · timeline→mind 81 · mind→timeline 78 · self→self 54 ·
timeline→timeline 51 · interests→mind 45 · mind→self 40 · mind→interests 40 ·
self→mind 39 · places→people 33 · work→mind 31 · people→places 30 ·
people→work 28 · work→people 28.

Shape, verbatim:

```yaml
connections:
  - page: wiki/mind/synthesis/2020-left-turn
    type: causes
    claim: "The lockdown's micro-radius siege is the documented condition of the
            August 2020 socialist conversion — the reading and media binge are
            self-dated to being stuck inside."
```

> **Trap (2026-08-30).** Do not count typed edges with a bare `- page:` regex
> over `fmRaw`. Three `meta/journeys/*` pages list their stops as `- page:` items
> under a `stops:` key, not `connections:` — a naive scan counts 2,320 and
> credits `meta` with 16 typed edges it does not have. Scope the match to the
> `connections:` block (as `build-core.mjs` does) and the total is 2,304 with
> `meta` at 0.

> **Trap.** `index.json.edges` (3,801) is the **untyped** wikilink graph. The 2,304
> typed connections are a *different, smaller, richer* graph that exists **only in
> `fmRaw`**. `lists.connections` flattens each entry to the string `"page: ..."`
> and drops `type` and `claim` entirely. To mine typed edges you must parse
> `fmRaw`.

### 1.5 `gaps.json`, `sage.json`, `lexicon.json`

**`gaps.json`** (299 KB) — `{ generatedAt, counts: { open: 484, pages: 151,
staged: 0 }, pages: [...] }`. Page entry `{ slug, domain, title, staged: null,
gaps: [{ text, label }] }`. Mirrors the per-page `gaps` arrays exactly.
By domain: people 68 · mind 42 · timeline 17 · self 8 · interests 4 · places 4 ·
work 4 · health 2 · legal 2.

**`sage.json`** (52 KB) — `{ counts: { asked: 3, pending: 0, answered: 3,
declined: 0 }, entries }`. Entry `{ id, asked, asker, status, answered, capture,
cites[], question, answer }`. 3 entries, all answered. `cites` mixes `wiki/*.md`
and `raw/*` paths — a Q&A→page citation graph.

**`lexicon.json`** (313 B) — a slang-capture queue with **1 entry**. Effectively
empty; not worth reading.

### 1.6 `assets/` — 6 files, 654 KB

5 JPG + 1 PNG. Path mirrors the slug:
`assets/<domain>/<slug>/<domain>-<slug>-<base36-ts>.<ext>`. Four are referenced
from page front-matter (`image` + `image_caption`); two are orphaned. **Zero
inline `![](…)` markdown images anywhere in any body.**

### 1.7 Domain aggregates

| domain | pages | words | avg | charts | outlinks | backlinks | gaps | infoboxes | typed edges out |
|---|---|---|---|---|---|---|---|---|---|
| people | 174 | 187,589 | 1,078 | 17 | 1,000 | 1,518 | 168 | 173 | 622 |
| interests | 96 | 41,075 | 428 | 13 | 372 | 432 | 10 | 0 | 176 |
| mind | 77 | 196,102 | 2,547 | 41 | 1,098 | 1,226 | 150 | 0 | 900 |
| timeline | 42 | 209,788 | 4,995 | 5 | 720 | 428 | 81 | 4 | 264 |
| self | 40 | 62,727 | 1,568 | 38 | 413 | 358 | 45 | 2 | 114 |
| work | 15 | 16,494 | 1,100 | 0 | 112 | 157 | 6 | 0 | 76 |
| places | 10 | 13,686 | 1,369 | 0 | 105 | 117 | 10 | 0 | 80 |
| meta | 9 | 32,856 | 3,651 | 6 | 498 | 33 | 0 | 0 | 0 |
| health | 5 | 9,507 | 1,901 | 1 | 62 | 46 | 11 | 0 | 46 |
| legal | 4 | 5,088 | 1,272 | 0 | 36 | 49 | 3 | 0 | 26 |
| **total** | **472** | **774,912** | 1,642 | **121** | **4,416** | **4,364** | **484** | **179** | **2,304** |

Note the inversion: `people` has the most pages, but `mind` and `timeline` each
carry more words, and `mind` dominates typed edges.

### 1.8 Other mineable structure in the wiki

- **119 chartable tables across 51 pages.** `countChartableTables` in
  `scripts/sync-wiki.mjs:161` defines the rule; `src/wiki/table.ts` already turns
  each into `{ form: 'line'|'bar', labelHeader, labels[], series[{name, values}],
  notes[], unit }`. `form` is `line` when ≥80% of ≥3 labels look temporal.
  High-value: `mind/concepts/contact-gini` (9 chartables on one page),
  `mind/profile/texting-deviance-audit` (8 numeric columns),
  `self/youtube-watch-history`, `self/location-history`, `people/annie-ulmer`,
  `people/suzanne-frank`, `self/lineage/23andme-genomics`. ~60 `people/*` pages
  carry an identical boilerplate `| Metric | Value |` block — a uniform per-person
  stat table.
- **One explicit `chart:` front-matter block** on `mind/synthesis/annual-volume-suz`
  — a richer schema than the derived specs, and the intended shape.
- **`changelog:` on 20 pages** — `list[{date, note}]`, human-written revision
  rationale. `people/annie-ulmer` has 14 entries dated 2026-07-11 → 2026-08-23,
  with same-day suffixes like `2026-08-23b`.
- **`journey:` on 3 pages** under `meta/journeys/` — `{ stops: [{page, note}] }`,
  5–6 stops each. Hand-authored narrative walks through the graph.
- **`sources:` — a provenance bipartite graph.** 1,254 refs across 361 pages
  (block form) + 146 more flow-form in `meta`. By extension: md 567 · csv 279 ·
  txt 201 · html 110 · docx 40 · none 23 · pdf 9 · m4a 8 · zip 8 · rtf 5 ·
  json 3 · jsonl 1. By raw directory: `raw/self/dox-md` 261 · `dox-scan` 214 ·
  `message-csv` 164 · `concerts` 94 · `facebook` 94 · `context-core` 76 ·
  `captures` 67 · `raw/people/captures` 50 · `dansynth` 35 · `chats` 27 ·
  `ancestry` 25 · `gemini-activity` 20 · `favorites` 16 · `audio` 14 + 11 smaller.
- **Body markup.** 8,684 `[[wiki/…]]` occurrences vs 4,466 deduped `links` — so
  link *frequency* per target is recoverable from bodies. Headings: 2,416 `##`,
  386 `###`, 1 `####`. Code fences: 34 unlabelled, 2 `bash`, 1 `sql`, 1 `mermaid`.
  **Only 2 external URLs in the entire corpus** — this is a closed world.
- **10 `brief` pages** and **3 `plain` twins** (all `mind/synthesis/*`).
- **The slug hierarchy is itself a tree**, 2–5 segments deep. `index.json` gives
  you only the flat domain; the path is a free treemap/sunburst.

### 1.9 Traps

1. `mind/synthesis/august-grievance-verdict` breaks YAML parsing — regex fallback
   or lose 12 typed edges.
2. `meta` values are **all strings**, including stringified arrays like
   `"[\"Annie\", \"Anne Ulmer\"]"` and `"[relationships, infidelity, nyc-era]"` —
   the latter is *not* valid JSON.
3. `related` / `sources` / `tags` / `aliases` split across `meta` (flow style) and
   `lists` (block style). **Read both** or undercount.
4. `lists.connections` is lossy. Use `fmRaw`.
5. `lists` occasionally holds empty arrays for scalar keys (`date_range_end: []`)
   — a parser artifact.
6. `date_range_end` can be the string `present`, or null.
7. `staged` is null on 100% of pages; `locked`/`sealed` counts are 0. Those code
   paths carry no data in this snapshot.

---

## 2. The transcript — `public/transcript/`

`index.json` (8.7 KB) + `months/*.json` (**91 files, 9.2 MB**).

```
count      134348
first      2015-11-28 18:47:54      last  2026-07-26 05:04:21
counts     { sent: 65350, received: 68998, attachments: 20,
             reactions: 109, characters: 5102026 }
span       { months: 129, covered: 91 }
handles    3 numbers, all the same correspondent, merged into one thread
years      [{ year, count, months }] × 11
months     [{ bin, from, count, sent, received, chars }] × 91
gaps       [{ from, to, months }] × 5
```

Per year: 2015 13,605 · 2016 12,520 · 2017 14,465 · 2018 21,970 · 2019 8,850 ·
2020 349 · 2022 3 · 2023 3,092 · 2024 16,637 · 2025 31,208 · 2026 11,649.

**The message row is `[timestamp, direction, text, flag]`** — verified, 134,348
rows, 100% arity 4.

- `timestamp` — `"YYYY-MM-DD HH:MM:SS"`, **local wall clock, no zone.** Every
  build script slices it as a string and never passes it to `Date()`. See the note
  at `scripts/build-clock.mjs:37-48`. Do the same.
- `direction` — `0` received (68,998), `1` sent (65,350).
- `text` — raw, nothing stripped.
- `flag` — **a bitfield, not an enum**: bit 0 = attachment, bit 1 = tapback.
  Observed: `0` 134,219 · `1` 20 (text is U+FFFC) · `2` 109 (text is
  `Emphasized "…"`). No row carries `3`.

`months/YYYY-MM.json` is `{ bin, from, count, m }` where `from` is the **global
1-based line number** of the month's first message, so `#L1234` anchors are stable
across the whole record.

**The 38 uncovered months, in 5 runs** — `2016-06` · `2016-09` · `2017-08` ·
`2020-08 → 2022-11` (28) · `2023-01 → 2023-07` (7). The README treats these as a
first-class constraint: a gap is *"a hole in a zip file, not a silence between two
people"* (README 1039, 1178, 1336-1345, 1483). Anything drawing this record must
draw the holes at their true width and must exclude them from silence rankings.

**One thread only.** Three handles, one correspondent. Direction is the sole
speaker axis. `wiki.json` describes a 33,698-message second thread that is **not
vendored here**.

---

## 3. The instrument datasets — `public/leviathan/` (10 files, 1.95 MB)

| file | bytes | contents |
|---|---|---|
| `accretion.json` | 32 K | 147 commits over 36 days. `points[147] = { sha, t, subject, pages, bytes, links, edges, d }` where `d` is the per-commit delta (`null` on the first). Day-one migration adds 260 pages / 978,201 bytes / 1,810 links / 1,455 edges. |
| `ask.json` | 60 K | 357 classified speech acts drawn from 18,946 messages, 2025-02 → 2026-06. `lanes[6]` each printing the **worst** per-category audit precision it folds (want 57%, fund 96%, denom 97%, code/see 100%). `records[357] = { d, t, k, lane, means, precision, x }` where `x` is verbatim message text. **Ships its own error bars** — rare. |
| `chronology.json` | 361 K | **6,937** dated mentions mined from wiki prose. `months[318]` 1900-01→2027-03, `years[83]` each with a `sample[]` of citing pages. Binned by the date *named*, not the date written. |
| `clock.json` | 321 K | **Every message as one integer.** `marks[134348]` delta-encoded; decode by prefix-sum then `value = day*2880 + minute*2 + dir`. Plus `hours[24] {all,sent,received}`, `years[11]`, `gaps[5]` with day indices. **The densest reusable payload in the repo.** |
| `lexicon.json` | 30 K | 965,583 tokens, 19,873 distinct, 2,592 shouts. `stoplist[182]` shipped inside the dataset so the one editorial choice is inspectable. `top[400]` post-stoplist `{word, all, sent, received}`, `topAll[60]` pre-stoplist, `months[91] {bin, count, shouts}`. |
| `mass.json` | 55 K | `domains[10]` and `pages[472] {slug,title,domain,words}` summing to 774,912. |
| `pen.json` | 8 K | `rows[128] { year, mentions, pages, domains, openings }`, 1900–2027. `openings` = pages whose earliest date is that year. |
| `recorder.json` | 14 K | `rows[129] { bin, covered, sent, received, words, days, messages, chars }` — **includes the 38 uncovered months as `covered: 0`.** The ready-made array for drawing gaps at real width. |
| `atlas.json` | 230 K | Hand-typed geography + IPF-reconstructed movement. `nodes[550]`, `edges[840] [a,b,roadIdx,metres]`, `roads[94]`, `cities[35]`, `waters[10]`, `places[86]`, `routes` (595 precomputed shortest paths), `days[1992] { d, s:[placeIdx,arriveMin,departMin,…] }`. |
| `wiki.json` | 856 K | **Nine instruments in one file.** See below. |

### `wiki.json` — the largest payload

`counts { pages: 486, words: 630514, chartables: 98, briefs: 10, edges: 3046 }`

| key | rows | shape |
|---|---|---|
| `domains` | 9 | `{ id, count }` |
| `claims` | 689 | `{ from, to, say }` — one sentence of prose asserting a link, the citation text itself |
| `census` | 117 | `{ slug, title, from, to, words, knownFor, relationship }` — people with spans |
| `tags` | 25 | `{ tag, pages[], count }` |
| `attention` | 486 | `{ slug, title, domain, words, named, backlinks }` |
| `web` | — | **`nodes[486]` with `x,y` already solved** + `edges[3536]` slug pairs. Drop-in graph, no simulation needed. |
| `health` | — | `{ pages, edges, reciprocal: 980, orphans[10], outDegrees[37], byDomain[9] }`. 108 pages have out-degree 0. |
| `evidence` | — | `{ references: 1170, roots[10], collections[40], extensions[12], pages[486], uncited: 139 }` — the map of off-repo raw corpora |
| `schema` | — | `{ fields[21] {field,count,share}, byDomain[9], types[11] }`. `domain`/`page_type`/`status`/`date_created`/`date_modified` at 100%; `tags` 94%; `importance` 13%. |
| `echo` | — | `{ measured: 464, total: 59586, identical: 32, byOverlap[200], byShared[200] }` — pairwise vocabulary Jaccard. A set operation, not embeddings. |

> **Drift warning, and how it was closed.** `wiki.json` sat at a 2026-08-21 build
> of **486 pages / 630,514 words** for eight days while `mass.json`,
> `public/wiki/index.json` and `public/agent/*` moved on, because nothing but a
> hand-run rebuilt it — a 33-page delta that made any cross-join wrong. `npm run
> wiki-instruments` joined the sync on 2026-08-29 and it now rebuilds with
> everything else; all of these payloads carry the **same** `generatedAt` as the
> snapshot they were derived from, which is the thing to compare before
> cross-joining any two of them.

---

## 4. Media and content modules

**`public/gallery/`** — `index.json` `{ counts: { items: 18, stills: 13,
motion: 5, bytes: 7280770 }, albums[1], items[18] }`. Item:
`{ id, album, kind, title, kana, caption, source, shot, src, w, h, bytes }`
(+`poster` on motion). 41 media files, 7.9 MB, with an 18-file sidecar JSON per
item. The manifest is fully derived — `build-gallery.mjs` parses JPEG SOF / PNG
IHDR / GIF / WebP VP8 headers for intrinsic size so cards lay out before media
arrives.

**`public/art/`** — 11 WebP (~563 KB), no JSON. Manifest is `SCENES` (9 entries)
in `src/content/art.ts`. **Nine sections ↔ nine scenes, mapped by array index —
a tenth section wraps onto `brain`'s plate unless a tenth scene is added.**

**`public/ally/`** — 5 JPEGs (~329 KB). Manifest is `ALLY` (5 entries) in the same
file, each with a dated quote and a wiki deep link.

**`src/content/`** — `sections.ts` (9 rooms), `art.ts` (`SCENES`, `ALLY`,
`SCENE_ORDER`, `KISS_FACES`), `crawls.ts` (`RATIO` 165 entries, `JET_FUEL` 17,
both deduped), `slogans.ts` (~12 lines, shuffled per seed by `banner()`).

**`src/lineage/data.ts`** — a 515-person / 218-family GEDCOM reduced to `PEOPLE`
(~47 records: `{id,name,gen,line,slot,born,died,birthPlace,deathPlace,wiki,
crossed,documented,collateral,role,note,short}`), `LINES` (5), `DESCENT`,
`HAPLOGROUPS`, `CORRIDORS`, `SURNAMES`. Autosomal fractions are computed
`1/2^gen`, not transcribed. A ready-made genealogy graph.

**`src/arcade/content.ts`** (21 KB) — `CABS`, `DROPS`, `SHELF`, `CATS`, `SCENES`,
`CANCER` (star field), `CANCER_EDGES` (constellation edges), `PRIZES`.

**Other payloads** — `public/agent/search.json` (314 KB, gitignored, built at
`prebuild`): `{ pages[472], lookup{776 keys} }`, an **alias→slug index** worth
reusing for any search box. `public/llms-full.txt` (5.2 MB, gitignored) is the
whole corpus as one markdown stream.

---

## 5. Off-repo sources — what is referenced and not vendored

Seven build scripts take an external path. This is the complete list of raw
sources this repository depends on but does not carry.

| npm command | external source | what it must contain |
|---|---|---|
| `npm run transcript -- ../leviathan` | `caakehorn/leviathan` | `data/transcript.json` — a ~9.4 MB envelope `{generated, target[], count, first, last, m[[ts,dir,text,flags]]}` |
| `npm run ask -- ../leviathan` | `caakehorn/leviathan` | `js/procurement-asks.js` — the hand-built 357-record ledger (sliced textually, never `eval`'d) |
| `npm run gallery:capture -- ../leviathan` | `caakehorn/leviathan` served on :8791 | `void.html`, `tree.html`, `data/*.json`. Needs Playwright + ffmpeg. **Cannot** capture the console — `data/leviathan.enc` needs the real passphrase. |
| `npm run accretion -- ../wiki-brain` | `caakehorn/wiki-brain` | **full git history** — the script refuses a shallow clone |
| `node scripts/sync-wiki.mjs ../wiki-brain` | `caakehorn/wiki-brain` | `wiki/**.md`, `plain/<slug>.md`, `wiki/assets/`, `sage/questions/`, `lexicon/words/` |
| `npm run atlas -- ../location-export` | Google Takeout Timeline | recursive `*.json` with `timelineObjects[].placeVisit` |
| `node scripts/build-art.mjs ./originals` | an `originals/` folder | src-01…src-10; needs `npm i --no-save sharp` |

Committed-rather-than-built, precisely because they derive from a repo this one
does not vendor: `public/transcript/**`, `public/gallery/**`,
`leviathan/ask.json`, `leviathan/accretion.json`, `leviathan/atlas.json`
(README 1144, 1223-1227, 1435). **That is the house precedent for committing a
derived payload.**

Raw corpora named only inside citations, none of which ship: `raw/self` (1,106
refs) · `raw/people` (34) · `raw/legal` (13) · `raw/mind` (6) · `raw/timeline` (3) ·
`raw/interests` (2) · `exports/annie-corpus.csv` · `/Volumes/MUSIC`. Named
collections: `dox-md` 247 · `dox-scan` 202 · **`message-csv` 153** · `concerts` 94 ·
`facebook` 91 · `context-core` 73 · `captures` 63 · `dansynth` 35 · `chats` 26 ·
`ancestry` 24 · `gemini-activity` 21 · `favorites` 16 · `audio` 13 ·
`youtube-watch-history` 7 · `gmail-captures` 6 · `chatgpt-export` 3 ·
`google-drive-export` 3 · `twitter` 4 · `imessage` 4.

The nine raw iMessage CSVs the ask ledger was merged from are listed in
`ask.json.meta.files`, including `MASTER_MESSAGES_DB_DUMP.csv`.

**The site writes back.** `sage/questions/<id>.md` is committed to
`caakehorn/wiki-brain` at runtime through the encrypted keyring (README 28, 807,
834).

---

## 6. Rendering the site — what a new room needs

Kept here because every visualiser hits it.

**A section is 3 edits + 2 files.** Append to `SECTIONS` in
`src/content/sections.ts` (`{slug, title, short?, kana, blurb, status, accent 1-5,
chant: banner('<slug>')}`), add a lazy route in `src/App.tsx` above the `/:slug`
catch-all, write `src/routes/X.tsx` exporting a **named** `XRoute`, write its CSS.
Nav chip, home portal card, ROOMS count, Terminal `go`/`rooms`/`tree`, and the
`SectionArt` plate all come free from the registry. A section in `SECTIONS` with
no route still renders — it lands on `Stub`, the intended "door before room" state.

**The chrome every room wears:**

```jsx
const section = sectionBySlug('slug')!
<div className="x" style={{ ['--glow' as string]: `var(--n${section.accent})` }}>
  <Nav />
  <SectionArt slug="slug" />
  <Marquee text={section.chant} duration={20} tone={section.accent}
           size="clamp(0.75rem, 1.6vw, 1.05rem)" />
  <header className="wrap x__masthead">…</header>
</div>
```

Rooms with sub-routes factor that into a local `<Wing>`/`<Floor>` wrapper — see
`Leviathan.tsx` and `Arcade.tsx`. `Transcript.tsx` (56 lines) is the cleanest
template. `Lineage.tsx` is the outlier; don't copy it.

**Root element invariant** — `position: relative; z-index: 1; min-height: 100%`
plus a radial-gradient-over-`--void` background. The `Fx` layers sit at z-index 0
and will cover a room that omits this.

**Tokens.** Palette-independent and always safe: `--f-*` faces, `--step--1…5`
scale, `--chaos`/`--tempo`/`--tilt`/`--glow-r`, the `--p-*` paint box, the copy
shop (`--paper`, `--toner`, `--spot`), `--oil`/`--brush`/`--staple`, `--on-glow`,
`--crawl-h`/`--rule`/`--gutter`/`--hard`, `--spring`/`--glide`/`--snap`.
Palette-dependent: `--void`, `--void-2`, `--void-3`, `--edge`, `--n1…--n5`,
`--text`, `--text-dim`.

> **Five palettes, and two of them collapse the accent ramp.** `griptape` has
> `--n1 === --n5` (bone); `riot` has `--n1 === --n4` (spot red) and
> `--n2 === --n5` (toner). A design needing five separable hues breaks in two of
> five. `riot` also **inverts** — `--void` is paper, `--text` is toner — so nothing
> may hard-code a light foreground and no glow can be assumed to read. ~66 rules
> across `punk.css` and `street.css` already key off `[data-vibe='riot']` to kill
> light sources.

`--glow` is **not** a token — it is set inline per component as
`var(--n${accent})`. Always read it with a fallback. `--graph-ink` is defined
**only** in `riot`; `src/wiki/Cortex.tsx:47` reads it defensively.

**Portal state** (`usePortal()`): `vibe`/`setVibe`, `chaos`/`setChaos`,
`entered`/`enter`, `registerRig`/`rigs`/`pokeRig`/`lastPoked`,
**`motion`/`setMotion`**, `readMode`/`setReadMode`,
`headerCollapsed`/`toggleHeaderCollapsed`. `motion` is derived, not stored:
`motionPref ?? !osCalm`, tracking `prefers-reduced-motion` live. **Anything that
animates must read it and stop.** State is painted onto `<html>` as
`data-vibe`, `data-still`, `data-read` and `--chaos` for plain CSS to read.

**Build gates.** `npm run build` = `tsc -b && vite build`. Strict, plus
`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`,
`noUncheckedSideEffectImports`, and **`verbatimModuleSyntax`** — type-only imports
must be written `import type`. No ESLint, no Prettier, no test runner. CI runs
`sage:check`, `gate:verify`, then the build.

**Every asset URL must go through `import.meta.env.BASE_URL`** — the site deploys
to the subpath `/home/` and Vite does not rewrite string literals.
`src/content/art.ts` carries a 25-line comment about the production-only 404 this
caused once.

**Rendering today is 100% canvas 2D.** Zero WebGL, zero three.js, zero shaders,
zero `OffscreenCanvas`, zero `Worker`, no graphics dependency. Thirteen `getContext`
sites, all `'2d'`. The rAF reference implementation is `src/components/Crawl.tsx`:
refs instead of state so the loop never restarts, frame-rate-independent decay,
a `MAX_FRAME_MS` clamp, a `visibilitychange` reset, one `translate3d` per frame,
and an early return when `motion` is false. `Atlas.tsx` adds the 10 Hz
`setTick` throttle that lets React render at 10 Hz while the canvas paints at 60.

---

## 7. Ranked: the best payloads to build on

1. **`fmRaw` typed connections** — 2,304 argued, typed, bidirectional edges with
   prose claims. Nothing on the site draws them. The rarest asset here.
2. **`clock.json.marks`** — 134,348 messages as packed ints, 320 KB. The only
   GPU-scale substrate in the repo.
3. **`index.json`** — 472 nodes with solved `x,y` + 3,801 integer-indexed edges.
   A graph you can draw without simulating.
4. **`gaps.json`** — 484 written statements of what is not known. Drawable absence.
5. **`chronology.json`** — 6,937 dated mentions, 1900→2027. The corpus's own sense
   of time, distinct from when it was written.
6. **`wiki.json.evidence` + per-page `sources`** — a page↔raw-corpus bipartite
   graph with clean type facets.
7. **`ask.json.records`** — 357 timestamped, categorised events carrying verbatim
   text *and* per-category precision. Ships its own error bars.
8. **119 chartable tables** — already extractable to `ChartSpec` by
   `src/wiki/table.ts`.
9. **`recorder.json.rows`** — 129 months with explicit `covered: 0` gap rows.
10. **`src/lineage/data.ts`** — 47 people, 5 lines, generation-indexed.

---

## 8. Maintaining this file

Re-crawl when you need a number and the stamp at the top is old. A figure here
being out of date is a documentation defect, and it is the only thing it is: no
build reads this file, and none should be made to.

That last clause is the whole lesson of 2026-08-29. This section used to say
"anything reading this corpus should assert against the numbers above and fail
loudly on drift", `build-core.mjs` did exactly that, and the result was a
mechanically-enforced requirement that a human re-crawl a 650-line dictionary
within the hour, every hour, forever — held against a wiki being actively
written. It failed for two days, froze the published snapshot behind a green
deploy, and trained its readers to clear it by retyping the number it printed.

A pipeline still refuses to ship a quietly-truncated dataset. It just proves the
dataset is whole by checking it against **its own input** and against **its own
last build**, both of which are present at build time, rather than against prose
somebody has to remember to update. See "How to use it" at the top for the two
questions and `scripts/build-core.mjs` for the worked implementation.

Where the source genuinely does not move — `build-atlas.mjs`'s published totals,
`check-atlas.mjs`'s bank counts — exact equality against a written figure is
still right, and those checks stay.
