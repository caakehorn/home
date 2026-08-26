/**
 * BUILD THE ART PLATES
 *
 * The house now has pictures in it. This is what turns the five originals into
 * the seven plates the site actually ships, and it exists so that "why is this
 * plate cropped like that" has an answer in the repo rather than in somebody's
 * memory of an afternoon.
 *
 * It is NOT part of `npm run build`. The plates are committed; this only ever
 * runs again if a source changes. `sharp` is therefore deliberately not a
 * dependency of the site — install it for the one run and throw it away:
 *
 *     npm install --no-save sharp
 *     node scripts/build-art.mjs ./originals
 *
 * `originals/` holds src-01 … src-08; six of the eight are still shipped. What
 * each one is, and what is done to it, is in PLATES below. Three arrived as
 * phone screenshots, so their crops are letterbox boxes measured by scanning
 * for the longest run of rows that are not black — not by somebody reading
 * coordinates off a ruler.
 *
 * ---- three jobs ---------------------------------------------------------
 *
 * 1. WATERMARKS COME OFF. Four of the originals arrived with somebody's
 *    hotlink stamp on them. They are cropped out, not blurred out — a blurred
 *    watermark is still a watermark and it is still in the composition.
 *
 * 2. NOTHING SHIPS AT SOURCE SIZE. One of the originals is 2099×2952, which
 *    is 6.2 megapixels of decode work for something that is 380px wide on the
 *    page. Every plate is cut to roughly twice its largest on-page box and
 *    encoded as WebP.
 *
 * 3. ONE REAL KNOCKOUT. Plate 05 was shot on flat white, so it is the only
 *    one that can be separated from its background honestly — a flood fill
 *    from the border gives it a true alpha channel and it floats over the page
 *    instead of sitting in a box. The other four are cut with `clip-path` in
 *    CSS instead (see cutout.css), which is a torn edge rather than an
 *    outline, and is the right cut for a photocopied flyer anyway.
 *
 * No colour grading happens here. The duotone, the halftone and the
 * registration ghosts are all CSS, so they follow the palette; baking them in
 * would freeze every plate to whichever room it was baked for.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import sharp from 'sharp'

const SRC = process.argv[2] ?? './originals'
const OUT = 'public/art'

/** @typedef {{ left: number, top: number, width: number, height: number }} Box */

const PLATES = [
  {
    id: 'kiss-neon',
    from: 'src-01.jpg',
    // 1920×1080. A hotlink stamp sat across the top-left corner; the crop
    // takes the top 62px off, which is above the pink one's hairline.
    crop: { left: 0, top: 62, width: 1920, height: 1018 },
    width: 1280,
  },
  {
    id: 'kiss-window',
    from: 'src-02.jpg',
    // 2048×1152, wallpaper-site stamp bottom-right. The bottom 84px go; the
    // composition ends at the shoulders well above that.
    crop: { left: 0, top: 0, width: 2048, height: 1068 },
    width: 1280,
  },
  {
    id: 'kiss-water',
    from: 'src-04.jpg',
    // 2099×2952 with a caption tag in the bottom-left corner. Cropped to the
    // two of them from the ring up, which loses the tag and the empty water.
    crop: { left: 250, top: 210, width: 1620, height: 1500 },
    width: 1120,
  },
  {
    id: 'kiss-close',
    from: 'src-07.png',
    // Letterboxed at 663..1128. The same two as `kiss-neon` from much closer,
    // and the same hotlink stamp sat in the top-left corner of the frame — the
    // extra 46 rows off the top are what takes it out.
    crop: { left: 0, top: 709, width: 828, height: 420 },
    width: 800,
  },
  {
    id: 'kiss-dark',
    from: 'src-08.png',
    // Letterboxed at 663..1128, nothing stamped on it.
    crop: { left: 0, top: 663, width: 828, height: 466 },
    width: 800,
  },
  {
    id: 'kiss-uniform',
    from: 'src-05.jpg',
    // Shot on flat white — the only one that gets a real alpha channel.
    crop: { left: 0, top: 0, width: 628, height: 900 },
    width: 620,
    knockout: true,
  },
]

/* ==========================================================================
   THE KNOCKOUT

   A flood fill inward from every border pixel, not a threshold over the whole
   image. The difference matters: the uniforms in plate 05 are cream and the
   socks are white, and a threshold takes them out along with the backdrop.
   A fill that can only reach what is CONNECTED to the edge cannot get inside
   a shirt, so the shirt survives.

   The edge is then feathered by one pass of a 3×3 box over the alpha channel.
   A hard binary alpha on a photograph reads as a bad cut-out; one pixel of
   ramp reads as a cut-out.
   ========================================================================== */

/** How far from white a pixel can be and still count as backdrop. */
const NEAR_WHITE = 208
/** How chromatic it can be. A cream sleeve is warm; the paper is not. */
const NEUTRAL = 26

async function knockout(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  const bg = new Uint8Array(width * height)
  const stack = []

  const isPaper = (i) => {
    const r = data[i * channels]
    const g = data[i * channels + 1]
    const b = data[i * channels + 2]
    if (r < NEAR_WHITE || g < NEAR_WHITE || b < NEAR_WHITE) return false
    return Math.max(r, g, b) - Math.min(r, g, b) <= NEUTRAL
  }

  const seed = (i) => {
    if (bg[i] || !isPaper(i)) return
    bg[i] = 1
    stack.push(i)
  }

  for (let x = 0; x < width; x++) {
    seed(x)
    seed((height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    seed(y * width)
    seed(y * width + width - 1)
  }

  while (stack.length) {
    const i = stack.pop()
    const x = i % width
    const y = (i - x) / width
    if (x > 0) seed(i - 1)
    if (x < width - 1) seed(i + 1)
    if (y > 0) seed(i - width)
    if (y < height - 1) seed(i + width)
  }

  // One box pass over the alpha only. Kept separate from the fill so the fill
  // stays a clean binary decision and the softness is obviously a second step.
  const alpha = new Uint8Array(width * height)
  for (let i = 0; i < alpha.length; i++) alpha[i] = bg[i] ? 0 : 255

  const soft = new Uint8Array(alpha.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      let n = 0
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= height) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= width) continue
          sum += alpha[yy * width + xx]
          n++
        }
      }
      soft[y * width + x] = Math.round(sum / n)
    }
  }

  for (let i = 0; i < soft.length; i++) data[i * channels + 3] = soft[i]

  const kept = alpha.reduce((n, a) => n + (a ? 1 : 0), 0)
  return {
    buffer: await sharp(data, { raw: { width, height, channels } }).png().toBuffer(),
    kept: kept / alpha.length,
  }
}

/* ========================================================================== */

async function main() {
  await mkdir(OUT, { recursive: true })
  const report = []

  for (const plate of PLATES) {
    const from = path.join(SRC, plate.from)
    let pipe = sharp(from).extract(plate.crop)


    pipe = pipe.resize({ width: plate.width, withoutEnlargement: true })

    let out
    let kept
    if (plate.knockout) {
      const cut = await knockout(await pipe.png().toBuffer())
      kept = cut.kept
      out = await sharp(cut.buffer).webp({ quality: 86, alphaQuality: 92 }).toBuffer()
    } else {
      out = await pipe.webp({ quality: 78 }).toBuffer()
    }

    const file = path.join(OUT, `${plate.id}.webp`)
    await writeFile(file, out)
    const meta = await sharp(out).metadata()
    report.push({ id: plate.id, w: meta.width, h: meta.height, kb: Math.round(out.length / 1024), kept })
    console.log(
      `${plate.id.padEnd(14)} ${String(meta.width).padStart(5)}×${String(meta.height).padEnd(5)} ` +
        `${String(Math.round(out.length / 1024)).padStart(4)} kB` +
        (kept === undefined ? '' : `   subject ${(kept * 100).toFixed(1)}% of frame`),
    )
  }

  const total = report.reduce((n, r) => n + r.kb, 0)
  console.log(`\n${report.length} plates · ${total} kB total`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
