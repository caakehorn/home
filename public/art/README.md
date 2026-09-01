# public/art — the frames

Twelve frames of animation, cut from screenshots and illustrations, plus two
faces that are not frames. They hang on the front door, in the masthead, on
the void band, and — via `<SectionArt>` — under the nav on every section
route, the wiki index, every wiki page and every blog post. `SCENES` in
`src/content/art.ts` is the manifest and `<Plate>` draws them.

**The table below is now the fallback rather than the assignment.** Anything
in it can be overruled from THE SLATE ROOM at `/slates` — see *Hanging them
somewhere else*, at the bottom of this file.

| file                  | what it is | where it hangs |
| ---------------------- | ---------- | -------------- |
| `kiss-window.webp`    | dark-haired and pink, in a window, morning | the front door, left |
| `kiss-neon.webp`      | pink and blonde, sparkles | the front door, right |
| `kiss-water.webp`     | blonde and black, green suits, on the water | the void band, the big one |
| `kiss-close.webp`     | the same two as `kiss-neon`, much nearer | the void band |
| `kiss-butterfly.webp` | teal and pink, butterfly-wing headphones | one of the nine section rooms |
| `kiss-mirror.webp`    | one holding a mirror, the other a makeup brush | one of the nine section rooms |
| `kiss-blush.webp`     | two in uniform, hands clasped, both blushing | one of the nine section rooms |
| `kiss-dark.webp`      | dark-haired and blonde, both with their eyes shut | the void band |
| `kiss-uniform.webp`   | two in uniform, knocked out of white | the masthead — the only one with a real alpha channel |
| `face-back.webp`      | the pink one's face, from `src-01` | inside THE KISS, filling the figure behind |
| `face-front.webp`     | the blonde's face, from `src-01`, flopped | inside THE KISS, filling the figure in front |

`kiss-blush` shipped at its native 348×345 rather than being cut down from
something bigger — it arrived that small and clean, with nothing to crop out,
and upscaling it would only have softened it.

`SectionArt` assigns each of the nine named rooms (`SECTIONS` in
`src/content/sections.ts`) one scene by fixed position, so no two rooms on the
nav bar ever open on the same picture — nine rooms, nine scenes, no wrap. A
wiki page or a blog post — anything outside those nine slugs — falls back to
a hash of its own path instead,
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

## Hanging them somewhere else

Everything above is a rule rather than a decision: a room gets the plate its
index lands on, the front door opens on whichever is third in the array. THE
SLATE ROOM at `/slates` is where that becomes a choice, and where a picture
that never went through `build-art.mjs` gets into this folder at all.

- **`src/content/board.json`** is the whole of the overriding. `walls` names a
  plate for one specific place — the masthead figure, the left half of the
  front door, the banner over one room. `pools` names the set the wiki and
  blog path hashes may draw from, because 486 wiki pages cannot each be given
  a picture by hand. `plates` lists the pictures uploaded through the room,
  which live in this folder beside the cut ones. An **empty board is exactly
  the assignment described above**, and `scripts/check-slates.mjs` asserts
  that against the components on every deploy.
- **The conversion is in the browser and it is the narrow version.** It
  decodes, honours the EXIF rotation a phone photo carries, downscales to a
  chosen longest edge, and re-encodes as WebP — nothing else. It does not
  crop, it cannot find a letterbox, and it cannot knock a background out. Any
  picture that needs one of those still goes through `build-art.mjs` on a
  machine with `sharp`, and the room says so on its own first screen.
- **A plate uploaded that way hangs nowhere until somebody hangs it.** It is
  in the folder, it is in the roster, and every wall is still on its
  fallback. That is deliberate: an upload that silently reassigned 486 wiki
  banners would be a worse tool than one that made you say where.

`src/content/slates.ts` is the registry of what is assignable, and adding a
wall there is the only way to make one appear in the dashboard — a dashboard
that offers a wall no component reads is a dashboard that lies quietly.

## Paths

Never write a leading slash. The site is served from `/home/`, and an absolute
path in TypeScript is not rewritten by Vite the way one in CSS is — that
mistake shipped once and broke every image on the deployed site while looking
fine in every local check. `src/content/art.ts` builds each path through
`import.meta.env.BASE_URL`; see the note at the top of that file.
