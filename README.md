# @danfrank

**Dan's Dialectical Database and Drug Den** — 弁証薬窟.

Three things under one roof, and they are the same thing. The **dialectic**:
every position here got argued at, usually at an hour no argument should be
trusted at. The **database**: it got written down anyway — 458 pages, cited,
cross-linked, contradictions left in where they are load-bearing. The **den**:
the room where both of those happened.

> THESIS · ANTITHESIS · ANOTHER BUMP · SYNTHESIS · CITE YOUR SOURCES ·
> LOSE THE ARGUMENT · LOG IT ANYWAY

Five rooms off one hallway: the **wiki-brain** and its map, **THE LATTICE**,
the **LEVIATHAN** instruments, **TRANSMISSIONS**, and an **arcade** of
experimental web games. Four are open; the arcade is a door with scaffolding
behind it.

## Running it

```bash
npm install
npm run dev        # vite dev server
npm run build      # tsc -b && vite build
npm run preview    # serve the production build
npm run typecheck
```

Serving from a subpath: `BASE_PATH=/home/ npm run build`.

## Deployment

Pushes to `main` build and publish to GitHub Pages via
`.github/workflows/deploy.yml` — live at **https://caakehorn.github.io/home/**.

Two things make the subpath work:

- `BASE_PATH` is set to `/<repo>/` in the workflow, so Vite rewrites every asset
  URL (including the `url(...)` font references in CSS) and the router picks the
  same value up through `import.meta.env.BASE_URL`.
- Pages has no SPA rewrite rule, so a cold load of `/home/brain` would 404 before
  the router boots. The build emits a copy of `index.html` as `404.html`; Pages
  serves it for unmatched paths and the app routes itself from there.

To check a production subpath build locally, build with `BASE_PATH` set and serve
`dist/` under that prefix with a 404 fallback — not `vite preview`, which serves
from the root and will not catch base-path mistakes.

## The gate

Three steps stand in front of the whole site — every room, every page. Nothing
behind them mounts: the router is not rendered until the gate resolves, so
there is no frame in which the site exists on screen unlocked.

0. **The terms.** An acceptance dialog with an explicit checkbox and an
   "I AGREE — ENTER" button that stays disabled until it is ticked. Declining
   ends the visit. Acceptance is recorded per device in `localStorage` against
   `TERMS_VERSION`, so a returning visitor is never asked twice and bumping the
   version asks everyone again. `/terms` renders the identical document from
   the same source and is **the one route in front of the gate** — terms you
   cannot read before agreeing to them are not terms.
1. **The quiz.** An empty submit passes. Anything else drops the visitor into a
   decoy that is always about to finish rebuilding an archive index and never
   does.
2. **The passphrase.** The only one of the three that is an actual lock.

Steps 0 and 1 are doormen. Step 2 is the boundary.

The lock is PBKDF2-SHA256 over the passphrase (250,000 iterations) and
AES-256-GCM, and it checks an entry by *decrypting* a small blob: a wrong
passphrase fails GCM authentication and throws. There is no stored hash, so
there is nothing on the wire to grind offline any faster than 250k iterations
per guess. Getting it wrong takes the whole screen for 30 seconds with a
countdown and no way through; the lockout is a **deadline in `sessionStorage`,
not a timer**, so reloading does not skip it — which makes it the rate limit
too. It flashes at about 1.5 Hz, half the 3 Hz general-flash threshold in
WCAG 2.3.1, and under `prefers-reduced-motion` it stops strobing but still
takes the page for the whole 30 seconds.

One unlock covers the tab. Append `#lock` to any URL to throw the bolt again —
it drops the stored passphrase, strips itself out of the URL and re-serves the
door, so the owner can see their own front step without opening a new tab.

Every dial and every line of copy sits in one block in `src/gate/config.ts`.
**`TAUNTS` is the block to edit** — the voice of the door is the owner's, and
nothing else in the codebase reads those strings.

### Building the verifier

```bash
HOME_PASSPHRASE='…' npm run gate:verify   # writes public/gate/verify.enc
```

The blob is a ciphertext, so committing it leaks nothing but the cost of
guessing. The passphrase itself is never written anywhere and cannot be
recovered from this repository, which is the point of the design.

**`public/gate/verify.enc` is committed.** It used to be gitignored, on the
reasoning that a verifier built from somebody's throwaway test phrase is worse
than none at all. That reasoning is fine and the consequence was not: no
verifier ever reached a deploy, so the gate took the `unconfigured` branch and
served **ENTER ANYWAY** to every visitor. The door was not locked. It is now.

Two ways to set it, and the precedence matters:

1. **Committed blob** (what this repo does) — run the command above with the
   phrase in the environment and commit the result.
2. **`HOME_PASSPHRASE` repository secret** — the Pages workflow rebuilds the
   verifier at build time when the secret is set, which **overwrites the
   committed one for that deploy**. That is the right way round, since a
   secret is the more authoritative place to keep a phrase — but it means a
   stale secret silently wins over the blob in the repo. If the deployed door
   stops matching the phrase you committed, that secret is why.

With no verifier from either route the gate says so on the passphrase step and
lets the visitor through, because a missing build secret should not brick the
site for everyone including its owner.

Rotating is one command and one commit. Anyone who fetched the old blob keeps
it forever, though, so rotation closes the door in front of new guesses and not
old ones — pick a phrase with enough entropy to survive a wordlist, because
250k PBKDF2 iterations buys time against a guesser, not immunity, and a public
repository hands them the blob to grind offline at their leisure.

### What the gate does not do

**It gates rendering, not access.** These still resolve for anyone who types
the URL, gate or no gate:

- `public/wiki/**` — the whole vendored wiki snapshot
- `public/leviathan/**` — the instrument datasets
- every asset in the build

And while this repository is public, all of it is readable on github.com
regardless of what the deployed site does. Real protection at rest means three
things, in this order: encrypt the payloads and have the pages decrypt them
with the gate's passphrase; purge the history, since git keeps every plaintext
blob ever committed; and make the repository private. Until those are done,
this is a lock on the front door of a building with windows — which is worth
having, and is not worth mistaking for something else.

## The type system

Three voices, taken from the grounding references, plus supporting cast. All
subsets are self-hosted in `public/fonts` — nothing is fetched at runtime.

| Token         | Face          | Job                                                       |
| ------------- | ------------- | --------------------------------------------------------- |
| `--f-logo`    | Titan One     | the oblique arcade shell, kept for the palettes that want it |
| `--f-head`    | Archivo Black | the wordmark, sub-headers, panel titles, ransom scraps      |
| `--f-ui`      | Archivo       | body copy                                                  |
| `--f-display` | Monoton       | neon-tube signage                                          |
| `--f-poster`  | Bungee        | stickers, marquees, chunky labels                          |
| `--f-mono`    | Space Mono    | meta, telemetry, eyebrows                                  |
| `--f-crt`     | VT323         | the shell only                                             |
| `--f-jp`      | system CJK    | kana and kanji accents (no CJK webfont — it's megabytes)   |

The three reference treatments live in `src/styles/type.css` as reusable
classes: `.wordmark` (two stacked copies — a stroked shell under a
gradient-clipped face, since `background-clip:text` and `-webkit-text-stroke`
won't share an element), `.subhead` (crackle texture multiplied into the fill,
over a slab), and `.firetext` (the same grotesque lit up, with a per-line
gradient so a five-line block stays evenly bright).

`src/styles/punk.css` then re-cuts all three — see below. The rainbow ramp
becomes three inks, the bloom becomes a slab, the sodium glow becomes a
fluorescent tube in a squat, and the DAN/FRANK lockup drops Titan One for a
heavy grotesque. The logo is still a brand constant and still does not follow
the palette: the moment it repaints it stops being an identity.

## The punk layer

The site used to be arcade-bright: bubble letterforms, a seven-band rainbow
wordmark, twinkling sparkles, a soft additive R/G/B bloom behind every heading,
a sheen sweeping across the ENTER button. That is one coherent aesthetic — the
gumball machine — and it is the wrong one for a building whose banner says EAT
THE RICH.

`src/styles/punk.css` takes it apart and puts a photocopier in its place. Four
devices, which are the same device from four angles:

1. **the copier** — a halftone/flare `fx-toner` layer multiplied over the whole
   page, blown contrast, and misregistration for headline type
2. **the scissors** — `.torn`, `.torn-top`, `.snip`; nothing is cut square
3. **the tape** — `.taped`; everything is stuck down, badly, over something else
4. **the stencil** — `.hazard` bars, `.stencil` spray edges

It is applied to the classes the site already had rather than by rewriting
components, and it runs in **every** palette: punk is not a colour scheme, it
is what happens to the surface.

The one new component is **`<Ransom>`** (`src/components/Ransom.tsx`) — cut-up
headline type, six scraps from six sources. It is *seeded*, so a headline gets
one cut for the life of the build instead of reshuffling on every render, and
*word-atomic*, so a long headline wraps like text instead of shattering. The
whole string is on the wrapper as an `aria-label` and every scrap is
`aria-hidden`, so a screen reader gets the sentence and not twenty-two letters.

## Palettes

Six, swapped by `data-vibe` on `<html>`. **`basquiat` is the default and the
house style**: raw canvas, opaque primaries, no glow anywhere. `riot` is the
photocopier — toner on newsprint, one spot red, two inks and no third. The
other four (`den` · `untitled` · `slime` · `kaiju`) are the neon rooms, and you
have to ask for them.

Defined as custom properties in `src/styles/tokens.css`; every component reads
`--n1`…`--n5`, the `--void` and `--text` ramps, so nothing needs to know which
palette is live.

Two of the six put an accent where the others put a light source, which breaks
one assumption the rest of the site made everywhere: that text sitting **on** an
accent should be `--edge`. In `basquiat`, `--n5` *is* the ink, so a lit nav link
was black on black. `--on-glow` is the fix — it resolves to `--void`, which is
near-black in the dark rooms (nothing there changes) and paper in the light
ones. Anything whose background is `--glow` reads its text colour from it.

### The headings

Raw canvas does not do black headings. Flat black Archivo Black at 5rem on bone
is a legal notice: no weight of its own, and it kills the palette at the top of
every page. What the paintings do is put the word on a **slab** — a block of
cadmium or ferrari red or cobalt, hand-edged and not quite square, with the
letters over it in bone and the line drawn round them.

So `SubHead` renders that. The slab is the element that used to hold the RGB
bloom, reused and run through the `#oilstick` filter; one slab colour per room,
so no two headings on a walk through the site are the same block of paint. Prose
headings inside a page are not slabs — a painted block every four paragraphs is
unreadable — but they stop being black too: red at h2, cobalt below it.

## THE CRAWLS

Two banners fixed to the viewport, on every page behind the gate: **THE RATIO**
along the bottom travelling left, **JET FUEL** along the top travelling right.
The marquees inside a page are furniture you walk past; these are furniture you
live with, which is why they get the loudest treatment on the site short of the
masthead — a hazard bar on each outer edge and every node cut out of a
different sheet. The sticky nav parks under the top bar rather than sliding
beneath it, and `body` takes matching padding on both sides.

**The reader drives them.** They creep at 12–56 px/s (off `--chaos`, like
everything else loud). Scroll the page in either direction and they lunge
forward at a rate set by how hard you scrolled, then coast back down to a creep
over about a second. It is a rate control, not a direction control: scrolling
up speeds them up exactly like scrolling down, and neither ever runs backwards.
The feel to aim for is a flywheel — you are not steering it, you are spinning
it, and it always winds back down to the same idle. The hazard strips brighten
with `--rush` while they are being driven, so the feedback loop is visible.

They are the same component and the same physics; only the edge, the direction
and the list differ, so one scroll moves the pair identically and in mirror.

Two things about the implementation are deliberate:

- **It is not a CSS animation.** Every other banner here is two copies
  translated -50% by a keyframe, which is right when the rate is constant and
  wrong when it is not: a variable rate means restarting the animation on every
  scroll event (which jumps, because the new one starts at 0%) or driving
  `animation-delay` backwards, which fights the compositor. `Crawl.tsx` owns a
  rAF loop and writes one composited transform per frame instead.
- **It measures itself.** None of the geometry is written down. The component
  measures one copy of the sequence, works out how many copies cover the
  viewport plus one full wrap, and takes the offset modulo that width. The
  wrap is why the copy count covers the viewport *plus a whole sequence* —
  travelling right runs the track from `-width` to `0`, so the copies have to
  queue to the left instead of the right.

The content is in `src/content/crawls.ts`, and **the entries are nodes, not
sentences** — each is its own reply, its own scrap, and the `+` between them is
an operator rather than punctuation. So they live as arrays and the banner
draws one chip per entry with the operator between; nothing is ever joined into
a string and animated as prose, because then it stops being the form and starts
being a tagline.

**To grow either one: append to the array.** That is the whole maintenance
story — there is no duration, no width and no copy count to update, and the
loop stays seamless at any length. Order is reading order: each list opens on
its signature node and `GG` closes the ratio, so new material goes in the
middle unless it is meant to be the last word.

Growing them means pasting in a block of lines, and a block that size will
contain something already on the pile — `SKILL ISSUE` twice in one pass reads
as a bug rather than as a joke. So the source keeps every line exactly as it
was written and **the renderer never draws the same node twice**: entries are
collapsed on letters and digits only, first occurrence winning, which makes
`"Don't care, didn't laugh"` and `dont care didnt laugh` the same node while
leaving `"Not Funny Didn't Laugh"` a different one. In dev it logs what it
collapsed, so a duplicate is visible rather than merely absent.

Under `prefers-reduced-motion` they do not crawl. The strips stay put and
become horizontally scrollable instead — the request is for less motion, not
less content, and a banner you cannot read is not an accessible banner. Each
list is also rendered once, visually hidden, for screen readers; the duplicated
visual tracks are `aria-hidden`.

## Chaos

`--chaos` (0→1) is a single number on `<html>` that grain, glow radius, tilt,
animation tempo, particle count and blur all derive from. The dial writes it,
the shell can set it, and it persists to `localStorage` along with the palette.

## The agent surface

The portal renders 458 wiki pages through a React app behind a gate, which is
useless to a machine. So the same corpus is emitted a second way, for crawlers
and for agents that want to look something up and read it:

| endpoint | what it is |
| --- | --- |
| `/llms.txt` | the entry point — what this is, every endpoint, and the notable pages per domain |
| `/agent/manifest.json` | the contract: endpoints, the slug rule, what every field means |
| `/agent/search.json` | one compact record per page — title, aliases, tags, a one-line summary — plus a **name → slug lookup** |
| `/llms-full.txt` | the whole corpus as one markdown stream, for one-shot ingestion (~3 MB) |
| `/wiki/index.json` | every page with its counts and map coordinates |
| `/wiki/pages/{slug}.json` | the page itself; `body` is markdown |

The one rule: a slug's `/` becomes `__` in the filename, so `people/annie-ulmer`
is read at `wiki/pages/people__annie-ulmer.json`.

That makes a lookup four hops with no JavaScript anywhere: `llms.txt` →
manifest → `search.json` → the page. The lookup covers titles *and* aliases, so
"Annie", "Anne Louise Ulmer" and "@Lo_weez" all resolve to the same slug, and
`links`/`backlinks` on every page let an agent walk the graph from there.

Summaries are not generated: where a page carries an **LLM Quick Brief** the
summary *is* that brief, because it was already written to be read by a
machine. Everything else falls back to the opening prose, cut at a sentence.

`npm run agent` builds it, and `prebuild` runs it, so a deploy is always
current. None of it is committed — it is derived from `public/wiki/`, it
changes whenever any page does, and a 3 MB text file rewritten on every sync
would bloat the repository for nothing.

`public/robots.txt` says all of this is fair game and points at `llms.txt`.
To close it again, change that file's `Allow: /` to `Disallow: /` — though a
robots file is a request, not a control, and these payloads resolve either way.

## Editing the wiki, permanently

Every page has an editor, and the editor can **publish**. The portal is a
static site with no server behind it, so the browser commits:

1. **PUBLISH** sends the page's markdown — and any pictures on it — to
   [`caakehorn/wiki-brain`](https://github.com/caakehorn/wiki-brain), which is
   where the wiki actually lives. Pictures land beside the prose under
   `wiki/assets/<slug>/`.
2. It then fires a `repository_dispatch` at this repo, and
   `.github/workflows/sync-wiki.yml` re-runs `sync-wiki.mjs` against the
   updated source, rebuilds the derived datasets, commits the refreshed
   snapshot and deploys it.

A minute or two later the edit is live for everyone. Until then the local draft
keeps showing your version to you, so the page never appears to lose the change.

Writing to the source rather than to `public/wiki/` is the whole point of the
arrangement: that snapshot is a build artifact, and the next sync would
overwrite anything written into it. This way one edit survives every future
rebuild, and the derivation stays in the one script that has always owned it.

An hourly schedule runs the same sync as a backstop, so an edit still lands if
the dispatch never arrives.

### The token

Publishing needs a GitHub token, because there is no server to hold one. The
editor asks for it the first time and keeps it **in that tab** unless you tick
*remember on this device*; FORGET TOKEN drops it from both. It is sent only to
`api.github.com` and is never committed anywhere.

Make it a **fine-grained** token with **contents: read and write** on
`caakehorn/wiki-brain` and `caakehorn/home`, and nothing else. Contents-write
on `home` is what lets the browser fire the rebuild; neither repo needs any
other permission.

This is a write credential living in a browser on a public site, which is worth
saying out loud. It is scoped to two repositories, it is per-device, and it is
one click to revoke — but treat *remember on this device* as meaning a machine
you own.

## The map

`/brain` opens on **THE CORTEX** — the wiki as a place instead of a list. 458
pages in a card grid is a filing cabinet; the same pages laid out by what they
link to is something you can learn your way around.

Position carries the whole encoding. Domains settle into lobes, and the pages
that link across everything drift to the middle, which is where they belong.
Colour is state, never identity: one accent for every page, brightening for the
one under the cursor and its links, receding for anything filtered out — a
nine-hue rainbow would be unreadable and would say less.

- **hover** a star for its title and links · **click** to inspect it
- the probe panel lists what the page connects to, and those are buttons — walk
  the wiki link by link and only open a page when you mean it
- **drag** to pan, **scroll** to zoom, **double-click** to reset
- searching **lights the map** rather than emptying it; a single match is flown to
- a domain chip **frames its lobe**
- arrow keys walk between pages, Enter opens, Escape resets — the canvas is
  reachable from the keyboard, and **LIST** is the same set as plain cards

The coordinates are baked at sync time by `scripts/graph-layout.mjs` — a seeded
force layout run once in node — and shipped in `index.json` with the edge list.
The browser gets a finished map: nothing simulates on load, and the wiki is in
the same shape every time you walk into it. The canvas only repaints when
something actually moves.

## Briefs

The wiki writes an **LLM Quick Brief** on its load-bearing pages: every date,
name and number of a page compressed into one paragraph for a machine to
swallow whole. It is the densest thing on the page and usually the most
important, and as prose it is close to unreadable.

`src/wiki/brief.ts` takes those blocks apart — a pure text→shape pass, no React
in it — and `Brief.tsx` draws the result:

- **figures** — the quantities the prose buried, set large. A number only
  qualifies if it carries a unit, a phrase or a currency marker; percentiles
  and house numbers are true but are not statistics, and they are dropped.
- **timeline** — every date on one axis, spans as bars and instants as dots.
  One hue, because this is a sequence and not a set of categories; position
  carries the meaning, the direct labels carry identity.
- **state** — closed, live, unresolved, in transition. Glyph + word + hue, and
  a state under a negation ("not closed") is not a claim about the state, so it
  never reaches the row.
- **cast** — the pages the brief points at, linked, lighting up with whichever
  sentence names them.
- **facts** — one sentence per card, tagged by kind.

Hovering anything ties it back to the sentence it came from. The **TEXT**
toggle puts the original paragraph back, word for word: the prose is the
record, the visualisation is a reading of it.

Blocks that are already structured — tables, lists, anything under 40 words —
are left alone. `/brain?view=briefs` collects every brief in the wiki into one
deck, and `npm run briefs` prints what the parser extracted, which is the thing
to check after re-running `sync-wiki`.

## LEVIATHAN

`/leviathan` is the room where the old repo's visualizers get rebuilt. The
original is thirty-seven instruments over two sections, each a hand-wired page
that loaded its own payload and drew its own chrome. Here they get a rack:

- `src/leviathan/core.ts` — the registry (what an instrument *is*), the dataset
  loader, and the dataset shapes. An instrument is a row of data until it has a
  component, so the ones still waiting on a corpus are listed honestly rather
  than pretended at: **LIVE** is wired to a dataset that ships with this site,
  **SEALED** is declared and waiting on one that does not.
- `src/leviathan/Frame.tsx` — the chrome every instrument wears: numeral, name,
  what it was computed over, and — always, never optional — **how**. An
  instrument that cannot say how it got its numbers has no business being read.
- `scripts/build-leviathan.mjs` — the counting, done once at build time
  (`npm run leviathan`) instead of in every visitor's tab.

**THE RULE**, carried across from the original unchanged: *no instrument makes a
judgement*. Every number is a count, a date or a length, taken over the whole
corpus with nothing excluded and nothing weighted. No sentiment scoring, no
keyword list, no threshold chosen because of what it would surface. Anything
editorial would make the output a portrait of an argument; left alone, the
counts make a portrait of the thing itself.

Two instruments are built:

- **I · THE MASS** — where the corpus's weight actually sits. Nine domains by
  word count, page-length distribution, heaviest pages; click a domain and the
  panels below follow it.
- **II · THE CHRONOLOGY** — every date the wiki names, mined out of its own
  prose rather than off its timeline pages, binned by year across 1900→2026.
  What it shows is not when things happened but when the record *says* things
  happened, which is a different and more honest object. Open a year for its
  months and every page that named it.

The dates come from the same matchers the brief visualiser uses
(`mineDates` in `src/wiki/brief.ts`), so a date reads the same way on the
instrument as it does on the page.

The sealed instruments need the message corpus, which is **not** vendored into
this repository. The portal is ungated; the old site put a terms-and-passphrase
gate in front of that material. Bringing it across is a decision about exposure,
not a porting task, so the rack declares those instruments and stops there.

## TRANSMISSIONS

`/blog` is the zine. Posts are markdown files in `src/blog/posts/` with a small
frontmatter block, bundled at build time rather than fetched — there are going
to be dozens of them and not thousands, and a zine is not a corpus. The corpus
is next door.

```
---
title: NOTHING HERE IS TASTEFUL
slug: nothing-here-is-tasteful     # optional; defaults to the filename
date: 2026-04-02                   # ISO. Sorted on, printed as "2 APR 2026"
dek: One sentence. It runs on the card and under the headline.
tags: design, manifesto, argument
kana: 悪趣味
tone: 5                            # 1-5, picks --n1..--n5 as the post's accent
---
```

Drop a file in and it is live: the index, the tag counts, the search and the
prev/next pager all derive from `src/blog/posts.ts`. Nothing else to register.

The body goes through **the wiki's markdown renderer, unchanged** — same charts
out of tables, same `[[wiki/…]]` links straight into the brain. A post and a
wiki page are the same organism seen from two angles, and giving the blog a
second renderer would have been the moment they stopped being that.

The index is a wall, not a feed: every post is a photocopied sheet, torn along
the bottom, taped at two corners, pasted on at an angle. The lead post is A3 and
its headline is set in `<Ransom>`; the rest are A5.

No RSS, no newsletter, no subscribe button, and **no analytics** — which is a
selfish position rather than a principled one, and the reason is in
[`nothing-here-is-tasteful`](src/blog/posts/nothing-here-is-tasteful.md).

## The rigs

Each announces itself on mount via `useRig`, so the HUD counts live elements
instead of a hard-coded number.

1. **CHAOS DIAL** — draggable/arrow-keyed knob, 0 to 11, drives `--chaos`
2. **VIBE SWITCH** — the six palettes
3. **SHELL** — 34 verbs, 8 of them listed in `help`; reads the corpus (`grep`,
   `whois`, `cite`, `hegel`), drives the site (`chaos`, `vibe`, `goto`,
   `overdose`, `narcan`), and takes the screen apart (`invert`, `flip`,
   `scanlines`, `nap`, `strobe`). `man <verb>` documents any of them and Tab
   completes over all of them.
4. **STICKER SLAB** — drag, fling, bounce, with momentum

The chaos dial and the palette switch also ride in the header on every page —
the console keeps the big versions, both surfaces drive the same state.

## Layout

```
src/
  components/        chrome (nav, marquee, crawl, HUD, cursor trail, FX, Ransom)
    rigs/            the six interactive elements
  content/           section definitions, banner slogans, the crawls
  routes/            Splash, Home, Stub, blog index + post, wiki index + page
  state/             palette + chaos context, persisted
  styles/            fonts, tokens, type treatments, punk, raw canvas, global
  blog/              the transmissions and their markdown
  gate/              the four steps in front of everything, and the terms
  leviathan/         the instrument rack: registry, frame, datasets
  wiki/              snapshot loading, markdown, charts, infoboxes, briefs, the map
```

`/` renders Home with Splash layered over it; entering dismisses the gate for
the session. Every room has a stub route, so no link dead-ends.
