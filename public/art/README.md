# public/art — the frames

Six frames of animation, cut from screenshots. They hang on the front door, in
the masthead and on the void band; `SCENES` in `src/content/art.ts` is the
manifest and `<Plate>` draws them.

| file                | what it is | where it hangs |
| ------------------- | ---------- | -------------- |
| `kiss-window.webp`  | dark-haired and pink, in a window, morning | the front door, left |
| `kiss-neon.webp`    | pink and blonde, sparkles | the front door, right |
| `kiss-water.webp`   | blonde and black, green suits, on the water | the void band, the big one |
| `kiss-close.webp`   | the same two as `kiss-neon`, much nearer | the void band |
| `kiss-dark.webp`    | dark-haired and blonde, both with their eyes shut | the void band |
| `kiss-uniform.webp` | two in uniform, knocked out of white | the masthead — the only one with a real alpha channel |

## Where they came from

Eight originals were supplied; six survive. `scripts/build-art.mjs` is the whole
transformation and it is committed alongside them, so the crops are a decision
in the repo rather than a memory of an afternoon. It is **not** wired into
`npm run build` — these are committed and it only runs again if a source
changes:

```
npm install --no-save sharp
node scripts/build-art.mjs ./originals
```

Three jobs, and nothing else:

- **Watermarks come off**, cropped rather than blurred. A blurred watermark is
  still a watermark and it is still in the composition.
- **Nothing ships at source size.** One original was 2099×2952 — 6.2 megapixels
  of decode for something 380 px wide on screen. Everything is cut to roughly
  twice its largest on-page box and encoded as WebP. The folder is ~300 kB.
- **One real knockout.** `kiss-uniform` was drawn on flat white, so a flood fill
  inward from the border gives it a true alpha channel and it floats over the
  page instead of sitting in a box. A *threshold* would have taken the cream
  uniforms out along with the backdrop; a fill that can only reach what is
  connected to the edge cannot get inside a shirt.

Three of the eight arrived as phone screenshots. Their crops are letterbox boxes
found by scanning for the longest run of rows that are not black, rather than by
reading coordinates off a ruler.

## What is not baked in

No colour grading. The halftone screen and the palette wash are both CSS
(`src/components/plate.css`), so a frame follows `[data-vibe]` — neon in VOID,
sodium in LOVE HOTEL, a second-generation photocopy in RIOT — off one file.
Baking any of it in would freeze every frame to whichever room it was baked for.

## Paths

Never write a leading slash. The site is served from `/home/`, and an absolute
path in TypeScript is not rewritten by Vite the way one in CSS is — that
mistake shipped once and broke every image on the deployed site while looking
fine in every local check. `src/content/art.ts` builds each path through
`import.meta.env.BASE_URL`; see the note at the top of that file.
