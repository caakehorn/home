# public/art — the frames

Eight frames of animation, cut from screenshots and illustrations. They hang
on the front door, in the masthead, on the void band, and — via
`<SectionArt>` — under the nav on every section route, the wiki index, every
wiki page and every blog post. `SCENES` in `src/content/art.ts` is the
manifest and `<Plate>` draws them.

| file                  | what it is | where it hangs |
| ---------------------- | ---------- | -------------- |
| `kiss-window.webp`    | dark-haired and pink, in a window, morning | the front door, left |
| `kiss-neon.webp`      | pink and blonde, sparkles | the front door, right |
| `kiss-water.webp`     | blonde and black, green suits, on the water | the void band, the big one |
| `kiss-close.webp`     | the same two as `kiss-neon`, much nearer | the void band |
| `kiss-butterfly.webp` | teal and pink, butterfly-wing headphones | one of the eight section rooms |
| `kiss-mirror.webp`    | one holding a mirror, the other a makeup brush | one of the eight section rooms |
| `kiss-dark.webp`      | dark-haired and blonde, both with their eyes shut | the void band |
| `kiss-uniform.webp`   | two in uniform, knocked out of white | the masthead — the only one with a real alpha channel |
| `face-back.webp`      | the pink one's face, from `src-01` | inside THE KISS, filling the figure behind |
| `face-front.webp`     | the blonde's face, from `src-01`, flopped | inside THE KISS, filling the figure in front |

`SectionArt` assigns each of the eight named rooms (`SECTIONS` in
`src/content/sections.ts`) one scene by fixed position, so no two rooms on the
nav bar ever open on the same picture. A wiki page or a blog post — anything
outside those eight slugs — falls back to a hash of its own path instead,
which is why the assignment there does not need a matching row here: there
are 486 wiki pages and eight pictures, and nothing stops two pages sharing a
plate the way two *rooms* never do. See `src/components/SectionArt.tsx`.

The last two are not hung anywhere. `src/components/Kiss.tsx` draws two
profiles as flat silhouettes and these fill them, clipped to the exact paths
that draw them, so the drawing is a window onto the picture rather than a shape
cut out of the dark. Both come out of `src-01`, which is the one frame where the
two of them are already arranged the way the drawing is — one facing right, one
facing left, nothing posed to fit.

`face-front` is flopped at build time. The front figure lives inside a
`translate(420 0) scale(-1 1)` group, so anything drawn in it is mirrored on the
way to the screen; flipping the file cancels that exactly once. `face-back` is
cropped tight on her face rather than on her head — she is drawn from behind, so
a crop of the whole head fills the silhouette with the back of her hair.

## Where they came from

Ten originals were supplied across three batches; eight survive. `scripts/
build-art.mjs` is the whole transformation and it is committed alongside them,
so the crops are a decision in the repo rather than a memory of an afternoon.
It is **not** wired into `npm run build` — these are committed and it only
runs again if a source changes:

```
npm install --no-save sharp
node scripts/build-art.mjs ./originals
```

Three jobs, and nothing else:

- **Watermarks and signatures come off**, cropped rather than blurred or
  painted over. A blurred watermark is still a watermark and it is still in
  the composition; `kiss-butterfly` lost its bottom 90px to an artist's
  signature in looping script the same way three others lost a hotlink stamp.
- **Nothing ships at source size.** One original was 2099×2952 — 6.2 megapixels
  of decode for something 380 px wide on screen. Everything is cut to roughly
  twice its largest on-page box and encoded as WebP. The folder is ~540 kB.
- **One real knockout.** `kiss-uniform` was drawn on flat white, so a flood fill
  inward from the border gives it a true alpha channel and it floats over the
  page instead of sitting in a box. A *threshold* would have taken the cream
  uniforms out along with the backdrop; a fill that can only reach what is
  connected to the edge cannot get inside a shirt.

Three of the ten arrived as phone screenshots; their crops are letterbox boxes
found by scanning for the longest run of rows that are not black, rather than
by reading coordinates off a ruler. Two — `kiss-butterfly` and `kiss-mirror` —
are full illustrations rather than screenshots and needed no letterboxing,
only the signature check above.

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
