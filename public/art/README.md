# public/art — the plates

Seven files. They are the art direction now, not decoration on top of it.

| file                | what it is | where it hangs |
| ------------------- | ---------- | -------------- |
| `kiss-neon.webp`    | pink and blonde, sparkles, a pink field behind them | the front door, right side |
| `kiss-window.webp`  | dark blue and pink, in a window, morning | the front door, left side |
| `kiss-water.webp`   | blonde and black, green suits, on the water | the void band, the big one |
| `kiss-uniform.webp` | two in uniform, knocked out of white | the masthead and the footer — the only one with a real alpha channel |
| `blob-figure.webp`  | the one that is not a kiss: a figure in a field of shapes | the void band, the counterweight |
| `blob-lips.webp`    | one mouth, lifted out of that field | a sticker, wherever a sticker is wanted |
| `blob-field.webp`   | the same field, blurred past reading | a surface, behind the void band and the portal cards |

## Where they came from

Five originals, supplied for this. `scripts/build-art.mjs` is the whole
transformation and it is committed alongside them, so the crops are a decision
in the repo rather than a memory of an afternoon. It is not wired into
`npm run build` — the plates are committed and the script only runs again if a
source changes:

```
npm install --no-save sharp
node scripts/build-art.mjs ./originals
```

Three of the five arrived with a hotlink watermark on them. Those are **cropped
out**, not blurred out; a blurred watermark is still a watermark and it is still
in the composition. What each crop takes and why is written next to it in the
script.

## Why only one of them has an alpha channel

`kiss-uniform` was drawn on flat white, so it is the only one that can be
separated from its background honestly — a flood fill inward from the border
gives it a true cut-out and it floats over the page instead of sitting in a box.

The other four are cut in CSS, by `clip-path`, with a deliberately ragged edge
(see `src/components/cutout.css`). That is the right cut anyway: this building
has been a photocopier and a pair of scissors since the punk pass, and a torn
edge belongs to it in a way that a clean outline never did.

## What is *not* baked in

No colour grading. The duotone, the halftone screen, the registration ghosts and
the bleed are all CSS, so they follow `[data-vibe]` — a plate looks like neon in
VOID, like sodium in LOVE HOTEL and like a second-generation photocopy in RIOT,
off one file. Baking any of that in would freeze every plate to whichever room
it happened to be baked for.

## Sizes

Every plate is cut to roughly twice its largest on-page box and encoded as WebP.
The whole folder is ~310 kB, and the two that are only ever small — the lips and
the field — are 5 kB and 12 kB. One of the originals was 2099×2952, which is
6.2 megapixels of decode for something that is 380 px wide on screen.
