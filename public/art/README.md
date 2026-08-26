# public/art — the plates

Ten files, nine of them pictures.

| file                | what it is | where it hangs |
| ------------------- | ---------- | -------------- |
| `kiss-neon.webp`    | pink and blonde, sparkles, a pink field behind them | the front door, right side |
| `kiss-close.webp`   | the same two, much closer | not hung yet |
| `kiss-window.webp`  | dark blue and pink, in a window, morning | the front door, left side |
| `kiss-water.webp`   | blonde and black, green suits, on the water | the void band, the big one |
| `kiss-dark.webp`    | dark-haired and blonde, both with their eyes shut | not hung yet |
| `kiss-uniform.webp` | two in uniform, knocked out of white | the masthead and the footer — the only one with a real alpha channel |
| `blob-figure.webp`  | the one that is not a kiss: a figure in a field of shapes | the void band, the counterweight |
| `blob-lips.webp`    | one mouth, lifted out of that field | a sticker, wherever a sticker is wanted |
| `blob-field.webp`   | the same field, blurred past reading | a surface, behind the void band |
| `poster-mort.webp`  | a gig poster: MORT ROSE with VANILLE, February 7 2019 | not hung yet |

Three are in the manifest and cut to size but are not placed on any page. That
is deliberate rather than half-finished — where they go is an open question at
the time of writing, and a plate sitting in `PLATES` costs nothing until a
component asks for it.

## Where they came from

Eight originals, supplied for this. The last three arrived as phone
screenshots, so their crops are letterbox boxes found by scanning for the
longest run of rows that are not black rather than by reading coordinates off a
ruler. `poster-mort` stops short of the bottom of its frame because the phone
had drawn its live-text button into that corner, over line art with hard edges
that no patch could honestly cover. `scripts/build-art.mjs` is the whole
transformation and it is committed alongside them, so the crops are a decision
in the repo rather than a memory of an afternoon. It is not wired into
`npm run build` — the plates are committed and the script only runs again if a
source changes:

```
npm install --no-save sharp
node scripts/build-art.mjs ./originals
```

Four of the eight arrived with a hotlink watermark on them. Those are **cropped
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
The whole folder is ~420 kB, and the two that are only ever small — the lips and
the field — are 5 kB and 12 kB. One of the originals was 2099×2952, which is
6.2 megapixels of decode for something that is 380 px wide on screen.
