# @danfrank

**Dan's Dialectical Database and Drug Den** — 弁証薬窟.

Three things under one roof, and they are the same thing. The **dialectic**:
every position here got argued at, usually at an hour no argument should be
trusted at. The **database**: it got written down anyway — 487 pages, cited,
cross-linked, contradictions left in where they are load-bearing. The **den**:
the room where both of those happened.

> THESIS · ANTITHESIS · ANOTHER BUMP · SYNTHESIS · CITE YOUR SOURCES ·
> LOSE THE ARGUMENT · LOG IT ANYWAY

Eight rooms off one hallway: the **wiki-brain** and its map, **THE SAGE**,
**THE LATTICE**, the **LEVIATHAN** instruments, **THE GALLERY**, **THE
TRANSCRIPT**, **TRANSMISSIONS**, and **ALLY LUBIN'S ADVENTURE ARCADE**. All
eight are open.

### The sage

`/sage` is the only room where the wiki is asked something rather than read.
Type a question about Dan — what he did, why, or what the record says he will do
next — and it is answered from the corpus with citations you can click and dated
quotes from the message record, including the ones that do not flatter him.

**Nothing on this site answers it.** There is no model behind the box, no API key
in the deploy, and no workflow that calls one. Pressing ASK commits
`sage/questions/<id>.md` to `caakehorn/wiki-brain` through the same keyring that
publishes a page edit, and fires the sync so the question appears in the log a
minute later marked *awaiting*. It is then priority 1 on that repository's
`WORK.md`, and a session working there answers it properly — retrieval across 486
pages plus `bin/mine-messages` over 134,348 messages — files the answer to
`raw/self/sage/` as permanent record, and stages what it found onto every page it
cited. Questions make the corpus bigger; that is the point of the loop.

The latency is the design and the room says so before you ask rather than after.
An answer here is one that read the sources and shows them.

The log renders three states and hides none of them: **awaiting** questions show
in full while they wait, **answered** ones carry their sources, and **declined**
ones carry the reason. A question nobody wanted to answer is visible as one.

Format details are in `sage/README.md` upstream. Three programs parse that file
and none imports the others, so `npm run sage:check` guards the contract and runs
in CI.

### The arcade

`/arcade` is the one wing addressed to a single named person, and it is named
after her because she is the only reader the wiki has ever had who got to the
end. Four cabinets and a prize counter, all of them built out of
`wiki/people/ally-lubin`:

| | cabinet | what it is |
|---|---|---|
| I | **ALU '08** | canvas catcher — catch the 2008 internet, let the marketing hit the floor |
| II | **EDGAR & SYLVIA** | breakout with a cat for a paddle and a shelf of knock-off-able objects |
| III | **THE COURTSHIP CONSOLE** | eight-scene dialogue game, 2013 → 2026, every line of his verbatim |
| IV | **WATER SIGNS** | wire the Cancer constellation star by star, then read the chart |

Cabinets pay one ticket per hundred points into a till in `localStorage`
(`alu-arcade-v1`); the counter spends them. The room carries its own palette
rather than following the vibe switch — an arcade is dark inside whatever the
weather is doing — and its classes are namespaced `arc-*` so nothing in
`punk.css` repaints them.

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
- `public/transcript/**` — the whole message record, 134,348 messages
- `public/gallery/**` — every plate on the gallery wall
- every asset in the build

And while this repository is public, all of it is readable on github.com
regardless of what the deployed site does. Real protection at rest means three
things, in this order: encrypt the payloads and have the pages decrypt them
with the gate's passphrase; purge the history, since git keeps every plaintext
blob ever committed; and make the repository private. Until those are done,
this is a lock on the front door of a building with windows — which is worth
having, and is not worth mistaking for something else.

The first of those three is now done for the pages that need it most, one page
at a time: see **[Sealed pages](#sealed-pages)**. The rest of the corpus still
sits behind rendering only.

## Sealed pages

The gate is one boundary for the whole site: everyone who is inside is inside
for everything. Some wiki pages are not that. They are in the wiki because the
wiki is where thinking goes, and they are not for whoever else has the door's
passphrase.

A **sealed page ships as a ciphertext**. Its body, frontmatter, infobox, lists,
counts, gaps and outbound links are AES-256-GCM under a PBKDF2-SHA256 key
(250,000 iterations) derived from a *second* passphrase — the same protocol as
the gate, `make-verify.mjs` and the keyring. The file the browser fetches from
`public/wiki/pages/` carries a slug, a domain, a title and the blob. There is no
plaintext of it in the build, in the repository, or in the derived datasets, so
this one is not a lock on rendering: without the phrase there is nothing to
render.

### Sealing a page

Name it in `wiki.locks.json` — slugs as they appear after `/brain/`, or a
prefix ending in `*` for a whole branch:

```json
{ "locked": ["self/concepts/a-page", "health/*"] }
```

```bash
WIKI_LOCK_PASSPHRASE='…' npm run wiki:lock    # seals public/wiki in place
```

That needs no wiki-brain checkout: it seals the snapshot this repository already
carries, so locking a page is a thing the owner can do from here alone. A page
can also ask for it from its own frontmatter upstream — `lock: true` in the
wiki-brain file — which is the route to use when the decision belongs next to
the writing. `sync-wiki.mjs` applies both, so a re-sync never unseals anything.

**Use a different phrase from the door's.** A lock that opens to the key
everyone in the building already has is a drawer.

If the manifest names a page and `WIKI_LOCK_PASSPHRASE` is not set, the sync
**stops before it writes anything** rather than publishing that page in the
clear. That is the one failure mode worth designing for here.

### Reading one

The page shows THIS PAGE IS SEALED and a passphrase field. There is no separate
verifier blob to check against — the page's own ciphertext is the check, the
way the gate's is. One unlock covers the tab (`sessionStorage`, like the door),
so a sealed branch can be read by following links through it; the decrypted
pages are held in memory and never written anywhere. **SEAL AGAIN** on an
opened page drops both, and is the analogue of the door's `#lock`.

Editing still works on an opened page, with one difference: its draft is **not**
autosaved to this browser, because that draft is the plaintext of a page that
ships as a ciphertext. Sealed edits live in the tab until PUBLISH, and the
editor says so.

### What stays visible, on purpose

The slug, the domain and the title. A sealed page keeps its URL and its place in
the index, in LIST and on the map, marked SEALED — the site says *there is a
page here and you cannot read it* rather than pretending it does not exist.
Hiding a title while its slug sits in the address bar is theatre, and a hole in
an index that counts itself is louder than a lock.

Everything else is struck out: the counts, the blurb, the gaps, and every edge
the map drew to it — an association is a fact about the page, so a sealed page
is also removed from every other page's *Linked from*, and the whole agent
surface (`llms.txt`, `llms-full.txt`, `/agent/*`) and every LEVIATHAN instrument
skip it.

### What it does not do

The same arithmetic as the keyring. The ciphertext is public, so the page is
only as private as the passphrase is unguessable; 250k iterations buys time
against a guesser, not immunity, and nothing rate-limits someone who has already
downloaded the file. Pick a phrase that survives a wordlist.

**Sealing is not retroactive.** Git keeps every plaintext blob ever committed,
so a page that has already been synced in the clear stays readable in this
repository's history until that history is purged. Seal before the first sync,
or purge, or accept that this closes the door in front of new readers only.

The committed LEVIATHAN datasets are baked from the snapshot, so sealing a page
leaves its words in `public/leviathan/*.json` until those are rebuilt. The
sealer checks for exactly that and names the files; the fix is
`npm run wiki-instruments && npm run leviathan`.

### In CI

The hourly wiki sync re-derives the snapshot from `caakehorn/wiki-brain`, which
means it re-seals too, which means it needs the phrase: put it in a
**`WIKI_LOCK_PASSPHRASE` repository secret** and the workflow passes it through.
Without it that job fails once anything is sealed — deliberately. A sync that
cannot seal is a sync that would publish those pages, and failing is the
correct outcome.

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

Five, swapped by `data-vibe` on `<html>`. **`void` is the default and the
house style**: acid green and electric violet on a black with a cast to it,
with whatever primary the next sign happens to be. The other four are
`dmt` (everything at once), `hotel` (sodium through a window that does not
open), `griptape` (the deck face down — black, bone, one acid stripe) and
`riot`, the photocopier, which used to be the house style and is now one room
off the street.

In `void` the acid is `--n3` on purpose. `--n3` is what links, kana, focus
rings and the default `.neon` all read from, so the green is the thing your eye
follows through the building rather than a colour that merely appears in it.

Defined as custom properties in `src/styles/tokens.css`; every component reads
`--n1`…`--n5`, the `--void` and `--text` ramps, so nothing needs to know which
palette is live. `void` also seeds bare `:root`, so the first paint — before the
provider has written `[data-vibe]` onto `<html>` — is already the house style.

`riot` puts an accent where the others put a light source, which breaks one
assumption the rest of the site made everywhere: that text sitting **on** an
accent should be `--edge`. On newsprint `--n5` *is* the ink, so a lit nav link
was black on black. `--on-glow` is the fix — it resolves to `--void`, which is
near-black in the dark rooms (nothing there changes) and paper on newsprint.
Anything whose background is `--glow` reads its text colour from it.

A palette that is retired simply leaves `VIBES`: a stored `vibe` that no longer
passes `isVibeId` falls back to the default on read, so nobody is stranded in a
room that is not there any more. The storage key was bumped to `v3` anyway, and
for the opposite reason: `riot` *survived* the redesign as a room, so every
returning visitor would have been handed back the palette the redesign
replaced and would never have seen it.

### The street layer

`punk.css` was written when `riot` was the house style and it is unconditional
— it repaints the logo in paper and spot red, flattens the wordmark to three
inks and turns the heading bloom into a slab of red, with `!important`, in
every palette. Correct when every room was a photocopy of one flyer; wrong once
the default is a lit room.

`src/styles/street.css` runs after it, scoped to `:not([data-vibe='riot'])`,
and hands those four devices back their colour. Construction survives from
punk everywhere — the scissors, the tape, the hazard bars, the hard offsets,
the refusal to round a corner — because those are construction and not colour,
and they are as much a skate deck as a 1977 flyer. `riot` keeps the
photocopier exactly as it was.

## The front door

`/` shows the splash once a session, in front of the home page and behind the
gate. It used to be a picture postcard — a crescent moon, a twinkling
starfield, a pagoda, three paper lanterns and a row of crows on a tiled roof.
Drawn well, and completely toothless: a tourist's idea of Tokyo in front of a
building whose banner says EAT THE RICH.

What replaced it is the other Tokyo — shot from a helicopter at 4am with the
colour pushed until it hurts. Four layers, and between them they animate
exactly two properties:

| | layer | what moves |
|---|---|---|
| 1 | **the floor** | one element in perspective, translated a tile on Y forever |
| 2 | **the bloom** | two conic gradients counter-rotating behind the mark |
| 3 | **the signage** | six vertical kanji columns drifting on Y at four speeds |
| 4 | **the barrage** | the title card, fourteen words on a `steps(1)` strobe |

No blurs, no backdrop filters, no per-frame JavaScript. The old door ran a
46-element starfield with a `drop-shadow` on every one of them — 46 blur passes
a frame before the type had loaded. The Japanese stayed and got harder; the
crown stayed and got promoted from a heading ornament to the thing directly
over the door.

## The brain console

The front page is a deployment portal for a 487-page wiki and it used to open
with three paragraphs on the meaning of the word *dialectic*, with the wiki as
slot one of an eight-card grid. You could not search it from the front page.
You could not resume it. The only answer to "where do I start" was `/brain`,
which opens on a force-directed map of 487 unlabelled dots — an answer to a
question you can only have once you have already read enough to ask it.

`src/wiki/Console.tsx` goes above everything else on `/` and does four things:

- **SEARCH** — scored, instant, keyboard-driven, `/` to focus from anywhere.
  Title hits outrank slug hits outrank blurb hits; weight is a tiebreak, not a
  ranking. Scored under `useDeferredValue`, so the field never waits on the
  487-row pass.
- **RESUME** — `src/wiki/trail.ts` records every page this browser opens.
  One button, back where you were, and read pages are ticked everywhere they
  appear.
- **ROUTES** — four ordered ways in, in `src/wiki/entry.ts`, each one derived
  from the index rather than hand-curated so none of them goes stale on the
  next sync. They do not overlap: each claims its stops and the next picks from
  what is left, so four routes cover twenty-four distinct pages instead of the
  same three, three times. Reading times are computed, never asserted.
- **THE BURIED** — see below.

A slimmer version of the same thing (`src/wiki/StartRail.tsx`) sits across the
top of `/brain`, above the map.

## The buried

"Hidden" is four different things in this corpus and the index rendered all
four as the same card with a word count on it:

| badge | what it means |
|---|---|
| **SEALED** 封 | encrypted in the snapshot; the row is the whole entry until somebody types the phrase |
| **ORPHAN** 孤 | finished, wired in, and linked from nowhere — you can only arrive on purpose |
| **STUB** 断 | started and not finished |
| **CLOSED** 終 | over, and kept anyway |
| **UNLIT** 暗 | long, finished, well-linked, and never on the obvious path |

Orphans are the interesting case and they need the edge list to find: `links`
on an index entry is the *outbound* count, and it is *inbound* that makes a
page findable. `inboundCounts` in `src/wiki/entry.ts` counts them off
`index.edges`.

The badges appear on the list cards, and `BURIED` is a fifth view on `/brain`
alongside MAP · LIST · BRIEFS · GAPS — the same act as the other four: MAP is
what connects, LIST is what exists, BRIEFS is what it says, GAPS is what it
admits it does not know, BURIED is what nothing points at.

## The relics

Ten Easter eggs — four on the front door, six on the main floor — each one a
real thing out of `wiki/people/ally-lubin` and the arcade's cartridge data: a
line she actually sent, a date the wiki derives rather than is told, a payment
that is in a ledger with a timestamp. They are in `src/content/relics.ts` and
the arcade's house rule applies to that file too: **the joke is never on her.**

Each is a visible sticker with a hover state, not a pixel-hunt. Clicking one
opens the line, the date, what it means, and a door into the room where the
long version lives. Found state is in `localStorage` via
`src/state/relics.ts`, published to React through `useSyncExternalStore` and
deliberately *not* in `PortalProvider` — most of the site consumes
`usePortal`, and it should not all re-render because somebody clicked a
sticker. A counter in the bottom-left corner follows you off both pages,
because "there are ten of these" is what turns a decoration into a hunt.

**Photographs.** Every relic takes one the moment one exists: drop a file into
`public/ally/` named for the relic's id (`top8.jpg`, `necklace.png`,
`cats.webp`) and the panel picks it up on its next open, with no code change
and no manifest to edit. `.jpg`, `.png` and `.webp` are probed in that order,
lazily, only for a relic somebody has actually opened. Until then the drawn
art in `src/components/RelicArt.tsx` stands in, and it is built to stand in
permanently — nothing looks unfinished with the folder empty.
`public/ally/README.md` carries the table and the one thing worth saying out
loud about putting photographs of a real person on a public page.

## What loads when

Everything used to be one 729 kB bundle, of which the door and the home page
use about a third; the rest is four arcade cabinets with their own game loops,
thirty leviathan instruments, a 134,348-row transcript reader, a gallery
lightbox and a markdown editor — all downloaded and parsed before the door
would open.

The eager set is now the critical path and nothing else: the door, the home
page, the wiki index and a wiki page (a deployment portal that code-splits its
own payload stutters on the one navigation everybody makes), plus the terms,
which render in front of the gate. Everything else is `React.lazy`, fetched on
arrival. Initial JS **729 kB → 451 kB**, initial CSS **231 kB → 132 kB**.

Three other things were costing more than they were worth and are gone:

- `backdrop-filter: blur()` on the sticky nav and the sticky transcript bar —
  a re-blur of everything behind them on every frame of every scroll, for a
  translucency that was invisible at 94% opacity over a black page.
- `filter: blur(40px)` on the full-viewport `.fx-bleed` haze, which was also
  being scaled — so it re-rasterised every frame. It was blurring three radial
  gradients, which have no hard edges to blur; the stops are wider now and the
  drift is translate-only.
- The cursor trail, entirely — see below.

## The reticle

`src/components/Cursor.tsx`. What was there before was a comet: up to 48 soft
circles, radius up to 21px, drawn additively and fading at 0.045 of their life
per frame. It *felt* slow without being slow — a 20px blob has no edge, so
there is nothing for the eye to lock onto and check against the actual pointer,
and softness reads as lag even at 60fps. It was also enormous, and it lied:
one sample per frame joined by big round dots means a fast flick drew a dotted
chord rather than the path your hand took.

Hard edges, one-pixel lines, and the true path:

- **The bracket** — four corner ticks of a small square, locked to the exact
  last reported position with no smoothing whatsoever, rotated to the direction
  of travel and splaying open with speed. Nothing interpolates, on purpose: a
  hard corner sitting precisely on the hotspot is checkable, so a frame of lag
  would be visible, so there is none. It stays parked when you stop — it is a
  reticle, and marking where the pointer is sitting is the job.
- **The blade** — a 1px tapering polyline through the recent 14 samples, drawn
  only above a walking pace and retracting into the bracket when the hand
  stops. Acid green at rest, magenta at speed.

Three things make it cheaper as well as sharper. `getCoalescedEvents()` draws
the real path from samples the browser had already captured, so a flick is a
curve rather than a chord. `pointerrawupdate` where it exists fires ahead of
the coalescing `pointermove` waits on. And it clears a **dirty rect** — the
union of what it drew last frame and this one, a few thousand pixels around the
pointer — instead of a full 1440×900 viewport every frame, and still sleeps
completely when the blade has drained and the hand has stopped.

Two bugs worth recording, because both are the same mistake. Speed was
initially measured between the last two points in the trail, which is wrong in
both directions: when the hand stops those two points stop changing, so the
reading holds at whatever the final flick was — speed never decays, the blade
never drains, and a parked pointer keeps a streak hanging off it. And when the
hand is fast, a coalesced batch delivers a dozen samples in one frame and the
gap between the last two is a twelfth of the real distance, so the reticle
reads a sprint as a stroll. The sum of distance actually covered over the frame
is simply the truth. The envelope on it is fast-attack/slow-release for the
same reason the bracket does not interpolate: a symmetric filter opens the
reticle several frames after you started moving, which is precisely the lag the
comet was replaced for.

Motion tokens live in `tokens.css`: `--spring`, `--spring-hard`, `--glide` and
the `--snap` / `--pop` / `--settle` durations. They are only ever spent on
`transform` and `opacity`, which is the whole strategy — the compositor can
animate those two without asking the main thread for a layout or a repaint, so
the site is busier than it was on a frame budget it was previously blowing on
blur.

## THE CRAWLS

Two banners fixed to the viewport, on every page behind the gate: **THE RATIO**
along the top travelling left, **JET FUEL** along the bottom travelling right.
The two travel in opposite directions on purpose — a pair going the same way
reads as one long strip that happens to be broken in the middle.
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
original is **thirty-seven instruments over two sections** — `◈ CORPUS` and
`◈ WIKI`, sharing one tab bar — plus **six more** on `procurement.html`, an
unlisted third page. Every one of the forty-three is in the registry here,
beside the five this house built:

- `src/leviathan/core.ts` — the registry (what an instrument *is*), the dataset
  loader, and the dataset shapes. Each entry carries the file and module it came
  from over there, so the port can be checked against the original.
- `src/leviathan/PenChart.tsx` — the chart recorder, shared. The old
  `js/pen-core.js` scaffold, with the stylus sitting where the value is instead
  of where `Math.random()` put it. THE PEN winds it over the wiki's dated
  mentions and THE RECORDER winds it over the message record.
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

### The five statuses, and why a rack lists what it cannot draw

A rack that lists only what is finished is a showreel, and a showreel cannot
tell you what is missing. The missing is most of the story, so every instrument
declares which kind of dark it is:

| | | |
| --- | --- | --- |
| **LIVE** | 21 | built here, wired to a dataset that ships |
| **PORTED** | 4 | came across under this house's own name — the card links to where |
| **UNBUILT** | 0 | the corpus is already here; nobody has built the instrument |
| **SEALED** | 5 | waiting on a corpus this site does not carry |
| **BARRED** | 17 | it makes a judgement, and THE RULE forbids one |

**BARRED is the one that matters.** The corpus half of the old console was
largely rhetorical scoring — LOVE, PROFANITY, APOLOGY, PLEADING, LOVE-BOMB,
DENIAL, ASSERTING against DEFERRING — which is exactly what THE RULE was
written against. Those do not come across. They are listed anyway, each with
the specific sentence saying which part of the rule it breaks, because quietly
dropping them would tell a nicer story about the old site than the old site
tells. Five of the six PROCUREMENT instruments are barred for the same reason
and are additionally never photographed; see THE GALLERY below. The sixth is
THE ASK, which came across and is LIVE — see below.

**UNBUILT is empty, and that is recent.** It used to be the to-do list: every
instrument whose corpus was already in the building and which nobody had built.
The record ships at `/transcript`, the snapshot ships at `/brain`, and the list
has been worked through. What is left dark is dark for a reason it can state —
SEALED wants a corpus this site does not carry, BARRED is not coming.

### What is built

- **THE HOUSE · I · THE MASS** — where the corpus's weight actually sits. Nine
  domains by word count, page-length distribution, heaviest pages; click a
  domain and the panels below follow it.
- **THE HOUSE · II · THE CHRONOLOGY** — every date the wiki names, mined out of
  its own prose rather than off its timeline pages, binned by year across
  1900→2026. What it shows is not when things happened but when the record
  *says* things happened, which is a different and more honest object.
- **THE HOUSE · III · THE PEN** — the chart recorder from the old console, four
  counts against one axis, each lane scaled to its own maximum.
- **THE HOUSE · IV · THE ACCRETION** — the wiki being built, against real time.
  See below.
- **THE HOUSE · V · THE RECORDER** — the same chart recorder, wound over the
  message record instead: SENT, RECEIVED, WORDS and DAYS per month across all
  129 of them. THE POLYGRAPH's drum without THE POLYGRAPH's pens, which were
  four keyword lists and stay barred. The 38 months no export covers are
  hatched at their real width and the stylus lifts across them, because a hole
  in an archive is not a quiet month. Built by `npm run recorder` out of
  `public/transcript/`.
- **◈ CORPUS · I · THE PULSE** — see below.
- **◈ CORPUS · II · THE CLOCK** — see below.
- **◈ CORPUS · XIV · THE SILENCE** — see below.

The dates come from the same matchers the brief visualiser uses
(`mineDates` in `src/wiki/brief.ts`), so a date reads the same way on the
instrument as it does on the page.

### THE PULSE, and the gaps it refuses to draw over

The whole record as one line you can throw: messages per day, one bar each,
3,894 of them, on a window that pans and zooms.

**A volume chart is the easiest place on this site to lie by accident.** The
exports cover 91 of the 129 months this record spans. Draw only the days they
cover and the twenty-eight missing months in the middle render as twenty-eight
months of silence between two people — which is a claim about a relationship,
made by a hole in a zip file. So the gaps are drawn **at their real width,
hatched and labelled**, exactly as THE TRANSCRIPT's rail draws them. Stating
them is a fact about the archive; leaving them out would have been a claim about
the thread. The runs come across in `clock.json`, converted to day indices off
the same day zero as the marks.

**The four era bands do not come across.** The old console banded NYC ONE,
UNIONTOWN, NYC TWO and RETURN behind this chart. Those boundaries were chosen by
hand and are not in the corpus, and a band drawn behind a volume curve is an
invitation to read the curve as caused by the band. What is left is the count.

It reads `clock.json` rather than a dataset of its own and folds the daily
counts out of the same marks THE CLOCK draws. Two instruments over one record
that load different files can disagree, and the only thing worse than a chart
nobody checks is two charts that quietly contradict each other.

Bars rather than a line, because a line between two days implies the days
between them and there are none. At full span several days land in one pixel
column and the tallest wins it, rather than the last — otherwise peaks appear
and vanish as the window is resized.

### THE CLOCK, and the timezone

```bash
npm run clock          # reads public/transcript/, writes public/leviathan/clock.json
```

Eleven years of messages on one spiral: **angle is the hour of the day, radius
is the date** — the first message at the centre, the last at the rim. One mark
per message, all 134,348 of them, nothing sampled and nothing binned. The dark
wedge across the small hours is somebody asleep, and the instrument says nothing
about that; the reader can see it without being told.

It was the first UNBUILT entry to be cleared, and it is the proof the status was
worth having: the rack had been saying for months that this one needed *nothing
from outside* — the corpus arrived with THE TRANSCRIPT — only the instrument.

**Timestamps are sliced out of the `"YYYY-MM-DD HH:MM:SS"` string and never
handed to `Date()`.** The export carries local wall-clock time with no zone on
it, so parsing it makes the runtime guess one, and on an instrument whose entire
axis is the hour of the day a guess in the wrong direction moves somebody's
bedtime to the afternoon. The old repo did it this way and said so; so does this
one. The build script also refuses to write a dataset whose message count
disagrees with `public/transcript/index.json` — if the months and the spine are
reading different records, the spiral would be quietly wrong rather than loudly
missing.

The file is 0.32 MB for 134,348 messages, because each one is packed into a
single integer (`day * 2880 + minute * 2 + dir`) and the sequence is then
delta-encoded. That is a compression of the *file*, not of the record: a prefix
sum and two remainders put every message back, and the instrument does exactly
that on load.

Two channels — sent and received — and direction is the only thing colour
encodes, so the pair has to separate in all five palettes. In RIOT it does not:
that room has two inks and `--n1` and `--n3` are the same red twice through the
machine. Where the ramp collapses the second channel falls back to bare paper,
and the legend reads the resolved pair back off the canvas so a key can never
disagree with the marks. The direction switch is the other half of the answer.

### THE ASK

```bash
npm run ask -- ../leviathan   # vendors js/procurement-asks.js -> public/leviathan/ask.json
```

The most carefully built instrument in the old repo, brought across whole: 357
records drawn from 18,946 messages, merged out of every thread export,
timezone-corrected, deduplicated, classified by speech-act frame plus named
object, and then read by hand with the false positives struck.

**The audit ships with it.** The per-category precision that survived that
manual read is in the dataset and is printed on the instrument — the same
arrangement the original used, and its own stated reason for it: a number
nobody can check is not evidence.

| lane | folds | precision |
| --- | --- | --- |
| NAMES THE BUY SIZE | `denom` | 97% |
| ASKS FOR IT | `want`, `order`, `chase`, `askSupply`, `askMoney`, `askOther` | **57%** |
| RAISES THE MONEY | `fund`, `ask3p` | 96% |
| HANDS OVER THE ATM CODE | `code` | 100% |
| IS THE SOURCE AROUND | `see` | 100% |

Each lane prints the **worst** precision among the categories it folds, because
a lane is only as good as its weakest member. Low-precision numbers are marked
with a symbol and an underline as well as ink, because the RIOT palette repeats
its two inks and a warning carried only by colour vanishes there.

The counting is **not** redone here. It was done by hand over there, and
re-deriving it in this repo would only invent a second, differently-wrong
ledger. `scripts/build-ask.mjs` reshapes the records into monthly lanes and
copies the audit through unchanged; it slices the object literal out of the
source file rather than evaluating it, so a build here cannot run whatever that
repository happens to contain.

The lane groupings are the original's, reproduced rather than re-argued — the
grouping is part of the classification, not a reading of it. `RUNNING TOTAL` is
the same records accumulated: a restatement of the other five, not a sixth
finding.

Like `transcript` and `accretion`, `ask.json` is committed rather than built in
CI, because it derives from a repository this one does not vendor.

### THE RECORDER, and the pens that did not come across

```bash
npm run recorder       # reads public/transcript/, writes public/leviathan/recorder.json
```

The old console's `MODULE 08 · draw_annie` was THE POLYGRAPH: a four-pen chart
recorder over the message record, and the best-looking thing on that site. It is
BARRED here and it stays barred. Its four pens were **LOVE, PROFANITY, APOLOGY
and SHOUT** — four keyword lists asked to stand in for a mood — and THE RULE
does not bend for an instrument that looks good.

**What comes across is the drum, not the pens.** THE PEN already wound
`PenChart` over the wiki's dated mentions; this winds the same one over the
corpus the polygraph actually ran on, with four channels that are only ever
counted:

| lane | what it counts |
| --- | --- |
| SENT | messages he sent that month |
| RECEIVED | messages he was sent |
| WORDS | runs of letters across both |
| DAYS | distinct days carrying at least one message |

A word is **THE LEXICON's word** — a run of letters and apostrophes, lowercased,
trimmed of apostrophes at either end, two characters or more — reused verbatim
rather than redefined, so the two instruments cannot disagree about what they
are both counting. The total comes out at 965,583 either way, which is the
check. Month and day are sliced out of the timestamp string and never handed to
`Date()`, for the reason THE CLOCK gives. The build refuses to write a dataset
whose message count disagrees with `public/transcript/index.json`.

**The 38 months no export covers are hatched at their real width and the stylus
lifts clean off the paper across them** — the same mark THE PULSE and THE RINGS
use. A trace drawn through them would read as a zero, and a zero is a claim that
nothing was said. What is true is that nothing was exported.

Each lane is scaled to its own maximum, printed beside it: WORDS peaks at 65,278
in a month and DAYS cannot exceed 31. Lanes are comparable in shape, never in
height. SENT and RECEIVED are read against their own peaks too, so where the two
traces part it is one side of the thread doing the writing; DAYS against either
is the difference between a month that was busy and a month that was busy on
four days.

### THE ACCRETION, and the one dataset that is not derived from the snapshot

Every other instrument reads `public/wiki/` — the corpus as it stands. That
snapshot is a single frame and cannot answer a question about growth, so this
one reads the only source that knows what the corpus *was*: the commit history
of [`caakehorn/wiki-brain`](https://github.com/caakehorn/wiki-brain).

Four counts per first-parent commit — pages, bytes, every `[[wiki/…]]`
occurrence, and distinct page→page pairs. Merges count once; replaying a
branch's commits and then its merge would count the same growth twice.

**The four lanes disagree, and that is the reading.** 260 pages arrive in a
single migration commit on day one. After it the page count rises 72% over five
weeks while bytes rise 278% — 231 bytes per page becomes 8,057. What grew was
not the number of pages but what is on them and what they point at, which is
`CLAUDE.md`'s "depth is the binding constraint" showing up as a measurement
rather than an instruction.

Each lane is scaled to its own maximum, printed beside it: pages are hundreds
and bytes are millions, so on a shared axis the byte curve would be the chart
and everything else a flat line on the floor. **Lanes are comparable in shape,
never in height.** The x-axis is real elapsed time rather than commit number, so
a quiet week looks like one. Nothing is smoothed — a moving average would file
the day-one step down into a gentle slope that never happened. The only scale
transform anywhere is a square root on the per-commit bars, disclosed on the
instrument, because one 260-page commit renders every other bar at under a pixel
linearly.

```bash
npm run accretion -- ../wiki-brain    # writes public/leviathan/accretion.json
```

**This dataset is committed**, unlike the other three, which `prebuild`
regenerates. It is derived from a repository this one does not vendor, so there
is nothing for CI to build it from — the same arrangement `sync-wiki.mjs` uses
for the wiki snapshot itself. Re-run it against a wiki-brain checkout when the
history has moved. It needs full history: the script refuses a shallow clone
rather than silently reporting a corpus that begins four commits ago.

The sealed instruments are what is left once the corpus question is settled.
`PROCUREMENT · VI · THE ASK` needs the classified ledger its rows were recounted
from, which is a hand-audited reading of the record rather than the record, and
is not vendored here — and it is barred as well as sealed, since a
classification of one person's requests is a judgement whatever the ledger says.
`◈ CORPUS · II · THE CLOCK` needed nothing from outside and is now built.

### THE SILENCE, and the difference between a gap and a hole

The negative space of the record: every gap between two consecutive messages,
how long it ran, and which line ended it. 66,454 of them.

**There are two kinds of nothing in this record and they are not the same
thing.** One is a silence: two people who could have written and did not. The
other is a hole: an export that does not cover those months, so nobody can say
what happened in them. Ranked together by length the holes take every position
at the top — the longest is 29.5 months — and an instrument that presented that
as its finding would be reporting the shape of a zip file as the shape of a
relationship.

So they are separated and both are shown. A gap whose span touches one of the 38
not-exported months is listed apart, hatched, tagged `NOT EXPORTED`, and kept
out of the ranking **and out of the histogram** — a distribution that includes a
hole has a tail made of missing files. With them out, the longest actual silence
is 1.3 months, and five silences run over a month.

**Cited, never quoted.** The message that ended a gap is given as its line number
in THE TRANSCRIPT and nothing else, linked. The words are one click away in the
room whose whole job is to hold them; reprinting them here would make this
instrument an argument about what broke a silence rather than a measurement of
how long it ran.

That citation only works because `scripts/build-clock.mjs` guarantees the marks
stay in the order the messages were sent, which makes **the index of a mark plus
one the global 1-based line number** — the identity the old repo's `#L1234`
anchors used. The build checks it rather than sorting, and refuses to write a
dataset that fails: re-ordering there would silently re-point every citation at
the wrong message.

One number on the page is not from the record and says so: **SINCE THE LAST
MESSAGE** is counted from the last message to the day the page loaded.

## THE GALLERY

`/gallery` is the room the old repo is hung in, and it is the only room here
that is not a reading of something.

Every other wing *rebuilt* the old work: took its dataset, dropped its chrome,
redrew it in this house's type and colour. That is the right way to inherit a
codebase and it loses the one thing a rebuild cannot carry, which is what the
original looked like. So this room does not rebuild anything. It photographs —
thirteen stills and five clips of VOID + LEVIATHAN running, in its own
slime-green, 7.3 MB.

```bash
npm i --no-save playwright                       # a capture-time tool, not a dependency
npm run gallery:capture -- ../leviathan          # shoots the plates
npm run gallery                                  # writes public/gallery/index.json
```

- `scripts/capture-gallery.mjs` — serves a leviathan checkout over
  `http://127.0.0.1`, drives a real browser at it, and shoots JPEG stills and
  WebM motion plates with a poster frame each.
- `scripts/build-gallery.mjs` — walks `public/gallery/media/` and writes the
  manifest.
- `src/gallery/` — the wall, the lightbox, the manifest loader.

**A rig rather than a folder of PNGs**, on purpose. A screenshot pasted into a
repository is an assertion; a rig that can be pointed at a commit is a method.
Every plate carries what it is a picture of and what the camera was told to do,
for the same reason every instrument owes a method line.

### How a page that is behind a gate gets photographed

THE GATE over there is a *render* gate — it hides `<body>` until a passphrase
sticks — and both of its modules bail out early if their global already exists,
so defining `window.LVGate` before the document runs is the whole bypass.
Nothing is decrypted and nothing needs to be: every page captured reads
plaintext data that ships in the open (`data/tree.json`, `data/wiki-data.json`,
`js/*-data.js`).

**The console itself is not capturable and is not attempted.** Its
thirty-seven instruments read `data/leviathan.enc`, which needs the real
passphrase. What is hung is PHASE 00, PHASE 01, and the pages that were never
encrypted.

The old pages pull React and Google Fonts off a CDN. Both are cached into
`.gallery-vendor/` (gitignored) on the first run and served back from disk, so a
capture is not at the mercy of a CDN and comes out the same on a second run.

### What is deliberately not photographed

THE DRUG LEDGER, THE FAMILY LEDGER, PROCUREMENT and THE ASK are all in the rack
and none of them is here. They are pages of verbatim quotation and composite
scoring about a named living person, they are **BARRED** for exactly that, and
photographing one instead would be the same act with a camera in front of it.

### Adding a picture that is not from the old repo

Nothing about the wall is hard-coded. Drop a file into
`public/gallery/media/<album>/`, optionally write a `<name>.json` sidecar beside
it (`title`, `kana`, `caption`, `source`, `shot`, `order`), re-run
`npm run gallery`, and it hangs. The album is the directory name; the id is the
filename and is the deep link (`/gallery/the-gravity-well`). A video pairs with
`<name>.poster.jpg` if one is there.

Intrinsic sizes are parsed out of the file headers — JPEG SOF, PNG IHDR, GIF
logical screen, WebP VP8/VP8L/VP8X — so every card knows how tall it will be
before its media arrives and a wall of forty settles once instead of jolting
forty times. A video's aspect comes off its poster, which is exact and means no
container parsing and no ffmpeg on the path to run `npm run gallery`.

**`public/gallery/**` is committed**, like `accretion.json` and
`public/transcript/**`: it derives from a repository this one does not vendor,
so there is nothing for CI to build it from.

## THE TRANSCRIPT

`/transcript` is the complete message record — 134,348 messages between Dan and
Annie, 2015-11-28 → 2026-07-26 — carried over intact from
[`caakehorn/leviathan`](https://github.com/caakehorn/leviathan). It is the one
room in the building that is not a reading of something. The wiki is prose
about this material, LEVIATHAN counts it, the lattice draws the family it
happened in; this is the material.

**THE RULE binds harder here than anywhere else.** No summary, no sentiment, no
selection, no highlights, no order but the order it was sent in. The only
things the room adds to the text are a line number, the timestamp already in
the export, and whatever filter the reader asked for.

### Getting it over

```bash
npm run transcript -- ../leviathan   # writes public/transcript/
```

`scripts/sync-transcript.mjs` reads `data/transcript.json` out of a leviathan
checkout — one envelope holding the whole record as `[timestamp, dir, text,
flags]` rows — and splits it at month boundaries:

- `public/transcript/index.json` — the spine: every month, its count, the line
  number it starts at, the totals, and the gaps.
- `public/transcript/months/YYYY-MM.json` — one file per covered month, 91 of
  them, fetched only when that month is opened.

The old site fetched the envelope whole: 9.4 MB before a single line was on
screen. **The split is a split.** Concatenate the months in bin order and you
have the envelope's `m` array back, in the same order, with the same timestamps
and the same flags — nothing dropped, reordered or edited. Line numbers are
global and 1-based, which is the identity the old repo's `#L1234` anchors used,
so a link into the record still lands on the same message.

**This dataset is committed**, like `accretion.json` and unlike the instrument
sets `prebuild` regenerates: it is derived from a repository this one does not
vendor, so there is nothing for CI to build it from. Re-run the script against a
leviathan checkout when the record moves — splitting by month means a re-sync
rewrites only the months that changed, rather than one nine-megabyte blob.

### The gaps

The record covers 91 of the 129 months it spans. **Those 38 missing months are
holes in the exports, not quiet months in the relationship**, and the two look
identical if you only draw the months that survived — so the runs are computed
from the file (2016-06, 2016-09, 2017-08, 2020-08 → 2022-11, 2023-01 → 2023-07)
and the rail draws them at their real width, hatched and labelled. Stating them
is a fact about the archive; leaving them out would have been a claim about the
thread.

### Reading it

The rail is the spine: every month as a bar sized by its own count, click to
open. Within a month the rows grow in chunks as you scroll, and
`content-visibility` keeps the browser from laying out what is off screen. Deep
links work cold — `#L1234` resolves to the month that line lives in, loads it,
grows far enough to reach it and scrolls to it, whatever was on screen before.

Search is the one thing that costs something. Searching all of it means having
all of it, so the first search pulls every month — about 9 MB — and says so
while it happens rather than stalling silently. It is cached for the session,
so the wait is per session and not per search. Every match is a line in the
record and links back into it.

### On putting it here at all

This README used to say the sealed instruments needed a corpus this repository
did not carry, and that bringing it across was *a decision about exposure, not a
porting task*. That decision has now been made, so its terms belong in writing
rather than in the implication:

- The record is **two people's**, and only one of them writes here.
- The gate gates rendering, not access. `public/transcript/**` resolves for
  anyone who types the URL, and while this repository is public it is readable
  on github.com regardless of what the deployed site does. The same three-step
  fix applies as everywhere else — encrypt at rest, purge the history, make the
  repository private — and none of it is done.
- `robots.txt` carries a `Disallow: /transcript/`, and the agent surface
  (`llms.txt`, `agent/`) is built from `public/wiki/` only, so the record is
  not in it. Both are requests, not controls.

`V · THE CLOCK` is the instrument that reads this corpus — Annie's 68,998
messages, placed by when they were sent. It stays SEALED, but for a different
reason than before: the corpus is here now, and the instrument is not built.

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
2. **VIBE SWITCH** — the five palettes
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
  styles/            fonts, tokens, type treatments, punk, global
  blog/              the transmissions and their markdown
  gate/              the four steps in front of everything, and the terms
  leviathan/         the instrument rack: registry, frame, datasets
  gallery/           the wall, the lightbox, the manifest loader
  transcript/        the message record: spine, month reader, whole-record search
  wiki/              snapshot loading, markdown, charts, infoboxes, briefs, the map
```

`/` renders Home with Splash layered over it; entering dismisses the gate for
the session. Every room has a stub route, so no link dead-ends.
