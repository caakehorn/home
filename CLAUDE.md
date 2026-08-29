# Working in this repository

Standing instructions for anyone — human or agent — building here.

---

## 1. Checkpoint long builds. Do not save it all for the end.

**The rule.** A build that runs longer than one milestone commits in checkpoints,
not at the end. Open the pull request after the *first* checkpoint — as a draft,
with the remaining checkpoints as a task list in the body — and push a commit at
every milestone where the tree is coherent: `npx tsc -b --noEmit` clean and
`npm run build` clean, even when the feature itself is unfinished.

Each checkpoint commit says what it completes and what is still stubbed. Never let
more than one milestone of work sit uncommitted.

**Why.** A session that ends unexpectedly — a lost container, an exhausted context
window, a dropped connection — must cost one step, not the whole build. A large
uncommitted working tree is the single most expensive thing to lose, and it is
lost silently.

**In practice.** Plan the work as a numbered checkpoint table before starting, and
put that table in the PR body so the state is legible from outside. Research and
inventory work counts as a checkpoint: commit the findings *before* building on
them, because notes that exist only in an agent's context die with it.

---

## 2. THE RULE — no instrument makes a judgement

Stated in full at the top of `src/leviathan/core.ts`, and it governs anything that
draws this corpus, not only the LEVIATHAN rack:

> Every number is a count, a date or a length, taken over the whole corpus with
> nothing excluded and nothing weighted. No sentiment scoring, no keyword lists,
> no threshold chosen for what it would surface.

Ten of the old console's thirty-seven instruments are `BARRED` under this rule and
stay barred. They are listed anyway, each with the reason attached, because a rack
that lists only what it can draw cannot tell you what is missing.

Consequences for new work:

- A visual channel must encode a count, a date, or a length. If it encodes a
  score, a mood, or a category somebody chose, it does not ship.
- Where a drawing decision *is* editorial — a layout, a palette, a hand-typed
  road — say so on the instrument. `THE ATLAS` prints `THE MAP IS DRAWN BY HAND`
  on every frame for exactly this reason.
- Where data is reconstructed rather than recorded, say that too, on every frame.
  `THE ATLAS` prints `RECONSTRUCTED` and stops only when handed a real export.
- A hole in an archive is not a silence. The 38 months no message export covers
  are drawn hatched at their true width and excluded from every ranking. Do the
  same with any gap you meet.

---

## 3. Make the claim checkable, in the build

Every generated dataset asserts something factual. Wire that assertion to a check
that fails loudly.

`scripts/build-atlas.mjs` is the reference: it reproduces eleven published
per-year totals and twenty published per-address totals **exactly**, verifies the
source wiki page still states the figures it was written against, and
`process.exit(1)`s if any of it drifts. A silently-truncated dataset looks exactly
like a working build; a failing one does not.

Also: generated payloads must be **deterministic**. Seed every PRNG (see
`mulberry32` in `build-atlas.mjs`), then verify by building twice and diffing with
`generatedAt` stripped. Unseeded `Set`/`Map` iteration order and stray `Date()`
calls are the usual culprits.

---

## 4. Look at the thing before calling it done

A clean typecheck proves nothing about a canvas. For any visual work, render it
and look at it.

**The isolated harness.** Two throwaway files at the repo root let you mount one
component with no router, no gate and no app shell:

```
core-harness.html      →  <script type="module" src="/src/core-harness.tsx">
src/core-harness.tsx   →  createRoot(...).render(<PortalProvider><MemoryRouter><Thing/>)
npx vite --port 5199 --strictPort
```

Vite serves any root HTML file, `public/` is still served so `fetch` works
unmodified, and both files get deleted before committing.

**Playwright in this environment.** The bundled browser path is version-mismatched.
Install Playwright outside the repo (a scratch directory, so `package.json` stays
clean) and launch with an explicit path:

```js
chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
```

To drive a React controlled `<input>` — `fill()` and `.value =` will not work,
because React's synthetic events never see them:

```js
const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
set.call(el, el.max)
el.dispatchEvent(new Event('input', { bubbles: true }))
```

Screenshot with `clip:` rather than `fullPage:` when inspecting a canvas — a full
page shot downscales the region you care about.

---

## 5. The traps that fail the build

- **Every asset URL goes through `import.meta.env.BASE_URL`.** The site deploys to
  the subpath `/home/`, and Vite does not rewrite string literals. There is a
  25-line comment in `src/content/art.ts` about the production-only 404 this
  caused once.
- **`verbatimModuleSyntax` is on.** Type-only imports must be written
  `import type { X }` or `import { type X }`.
- **`noUnusedLocals` and `noUnusedParameters` are on.** An unused import fails
  `tsc -b`, which fails the build, which fails the deploy.
- **A room's root element needs `position: relative; z-index: 1`.** The `Fx`
  layers sit at `z-index: 0` and will cover anything that omits it.
- **Five palettes, and two collapse the accent ramp.** `griptape` has
  `--n1 === --n5`; `riot` has `--n1 === --n4` and `--n2 === --n5`. A design that
  needs five separable hues breaks in two of five. `riot` also inverts —
  `--void` is paper, `--text` is toner — so never hard-code a light foreground and
  never assume a glow will read.
- **Anything that animates must read `motion` from `usePortal()` and stop when it
  is false.** `src/components/Crawl.tsx` is the reference rAF loop: refs instead
  of state so the loop never restarts, frame-rate-independent decay, a
  `MAX_FRAME_MS` clamp, a `visibilitychange` reset, one `translate3d` per frame,
  and an early return on `!motion`.
- **`npm ci` before believing a typecheck error.** `TS2688: Cannot find type
  definition file for 'node'` means empty `node_modules`, not broken code.

---

## 6. Where the data is

`docs/CORPUS.md` is the data dictionary: every payload in the repo, its exact
shape, its row counts, its enum distributions, its traps, and a ranked list of the
best payloads to build on. **Read it before writing a pipeline.** It exists so
nobody has to re-derive the corpus twice, and its numbers are meant to be asserted
against.

Datasets that are committed rather than built in CI — `public/transcript/**`,
`public/gallery/**`, `leviathan/ask.json`, `leviathan/accretion.json`,
`leviathan/atlas.json` — are committed precisely because they derive from
repositories this one does not vendor. That is the established precedent for
committing a derived payload; follow it rather than inventing a new one.

---

## 7. House style

No linter is configured, so the conventions are held by hand and by review:
2-space indent, no semicolons, single quotes, trailing commas, ~100-column wrap.

Every non-trivial module opens with a block comment explaining **why** it exists
and what decision it embodies — not what the code does. Read the top of
`src/leviathan/core.ts`, `scripts/build-clock.mjs` or `scripts/build-atlas.mjs`
before writing one. Match the register: plain, specific, and willing to say what
a thing cannot do.
