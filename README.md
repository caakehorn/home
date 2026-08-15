# 月光宿 MOONLIGHT INN

@danfrank's portal. A splash gate, a home page behind it, and the shell of four
wings: the **wiki-brain**, the **LEVIATHAN** visualizers, an **arcade** of
experimental web games, and **transmissions**.

> THE MORE EXCESS, THE BUSIER, THE MORE CHAOTIC, THE BRIGHTER, THE MORE NEON,
> THE MORE OBNOXIOUS, THE MORE VAPORWAVE THE BETTER

This pass is the aesthetic foundation only — visual identity, typography and the
interactive furniture. The wings are doors, not rooms yet.

## Running it

```bash
npm install
npm run dev        # vite dev server
npm run build      # tsc -b && vite build
npm run preview    # serve the production build
npm run typecheck
```

Serving from a subpath (GitHub Pages project site, say): `BASE_PATH=/home/ npm run build`.

## The type system

Three voices, taken from the grounding references, plus supporting cast. All
subsets are self-hosted in `public/fonts` — nothing is fetched at runtime.

| Token         | Face          | Job                                                       |
| ------------- | ------------- | --------------------------------------------------------- |
| `--f-logo`    | Titan One     | the wordmark: oblique, rainbow-banded, black shell         |
| `--f-head`    | Archivo Black | sub-headers, panel titles, the lit "sign" text             |
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
with an additive R/G/B bloom behind), and `.firetext` (the same grotesque lit
up, with a per-line gradient so a five-line block stays evenly bright).

## Palettes

Four, one per reference board, swapped by `data-vibe` on `<html>`:
`moonlight` · `untitled` · `slime` · `kaiju`. Defined as custom properties in
`src/styles/tokens.css`; every component reads `--n1`…`--n5`, `--void*`, `--text*`,
so nothing needs to know which palette is live.

## Chaos

`--chaos` (0→1) is a single number on `<html>` that grain, glow radius, tilt,
animation tempo, particle count and blur all derive from. The dial writes it,
the shell can set it, and it persists to `localStorage` along with the palette.

## The six rigs

Each announces itself on mount via `useRig`, so the HUD counts live elements
instead of a hard-coded number.

1. **CHAOS DIAL** — draggable/arrow-keyed knob, 0 to 11, drives `--chaos`
2. **VIBE SWITCH** — the four palettes
3. **SCRY POOL** — canvas flow field; pointer steers, click sends a shockwave
4. **SHELL** — real command handling (`help`, `ls`, `goto`, `vibe`, `chaos`, `status`, …), including navigation
5. **THE ORACLE** — gachapon lever, dispenses a verdict
6. **STICKER SLAB** — drag, fling, bounce, with momentum

## Layout

```
src/
  components/        chrome (nav, marquee, HUD, cursor trail, screen FX)
    rigs/            the six interactive elements
  content/           section definitions
  routes/            Splash, Home, Stub
  state/             palette + chaos context, persisted
  styles/            fonts, tokens, type treatments, global
```

`/` renders Home with Splash layered over it; entering dismisses the gate for
the session. Every wing has a stub route, so no link dead-ends.
