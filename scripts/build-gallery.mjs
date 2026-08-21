/**
 * THE GALLERY — the manifest.
 *
 *   npm run gallery
 *
 * Walks public/gallery/media/ and writes public/gallery/index.json: one entry
 * per picture, with its album, its intrinsic size and whatever its sidecar
 * says about it. Nothing here is hand-maintained — drop a file in, re-run,
 * and the room has it.
 *
 * ---- the shape on disk ---------------------------------------------------
 *
 *   public/gallery/media/<album>/<name>.jpg          a still
 *   public/gallery/media/<album>/<name>.json         its sidecar
 *   public/gallery/media/<album>/<name>.webm         a motion plate
 *   public/gallery/media/<album>/<name>.poster.jpg   the frame it shows at rest
 *   public/gallery/media/<album>/<name>.webm.json    its sidecar
 *
 * The album is the directory, and the sidecar is optional: a photograph
 * dropped in with no JSON beside it still hangs, titled from its filename.
 * A sidecar carries `title`, `kana`, `caption`, `source`, `shot` and `order`;
 * scripts/capture-gallery.mjs writes one for every plate it shoots.
 *
 * ---- why the sizes are read out of the files ------------------------------
 *
 * Every card is laid out from its real aspect ratio before the image arrives,
 * so a gallery of forty pictures settles once instead of reflowing forty
 * times as they land. That means the manifest has to know how big each file
 * is, which means parsing the headers — JPEG SOF, PNG IHDR, GIF logical
 * screen, WebP VP8/VP8L/VP8X. A video's aspect comes off its poster (or its
 * sidecar), which is exact and costs nothing: no container parsing, and no
 * ffmpeg on the path to run `npm run gallery`.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, extname, basename, relative, sep } from 'node:path'

const MEDIA = 'public/gallery/media'
const OUT = 'public/gallery/index.json'

const STILL = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'])
const MOTION = new Set(['.webm', '.mp4', '.mov', '.m4v'])

// ---------------------------------------------------------------------------
// intrinsic size, read out of the file header

/** @returns {{ w: number, h: number } | null} */
function measure(path) {
  let buf
  try {
    buf = readFileSync(path)
  } catch {
    return null
  }

  // PNG — IHDR is always the first chunk, width and height at bytes 16..24.
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
  }

  // GIF — the logical screen descriptor, little-endian, right after the magic.
  if (buf.length > 10 && buf.toString('latin1', 0, 3) === 'GIF') {
    return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) }
  }

  // WebP — three encodings under one RIFF wrapper, and they disagree about
  // where the size lives, so each is read where it actually is.
  if (buf.length > 30 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') {
    const kind = buf.toString('latin1', 12, 16)
    if (kind === 'VP8X') return { w: (buf.readUIntLE(24, 3) & 0xffffff) + 1, h: (buf.readUIntLE(27, 3) & 0xffffff) + 1 }
    if (kind === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff }
    if (kind === 'VP8L') {
      const bits = buf.readUInt32LE(21)
      return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 }
    }
  }

  // JPEG — walk the marker chain to the first start-of-frame. There is no
  // fixed offset: the size sits behind however many APPn/COM segments the
  // encoder felt like writing.
  if (buf.length > 4 && buf.readUInt16BE(0) === 0xffd8) {
    let i = 2
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++
        continue
      }
      const marker = buf[i + 1]
      // SOF0..SOF15, skipping the four that are not frame headers.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) }
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2
        continue
      }
      i += 2 + buf.readUInt16BE(i + 2)
    }
  }

  return null
}

// ---------------------------------------------------------------------------

function walk(dir) {
  /** @type {string[]} */
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(path))
    else out.push(path)
  }
  return out
}

const sidecarOf = (path) => {
  // `x.webm.json` first, then `x.json` — the second is what a still uses, and
  // what a person adding one photograph by hand would think to write.
  for (const candidate of [`${path}.json`, path.slice(0, -extname(path).length) + '.json']) {
    if (existsSync(candidate)) {
      try {
        return JSON.parse(readFileSync(candidate, 'utf8'))
      } catch (err) {
        console.error(`sidecar is not JSON: ${candidate}`)
        throw err
      }
    }
  }
  return {}
}

/** A filename is the fallback title: `the-gravity-well.jpg` → `THE GRAVITY WELL`. */
const titleOf = (name) => name.replace(/[-_]+/g, ' ').trim().toUpperCase()

if (!existsSync(MEDIA)) {
  console.error(`No media directory: ${MEDIA}`)
  console.error('Shoot the old repo first: node scripts/capture-gallery.mjs ../leviathan')
  process.exit(1)
}

const files = walk(MEDIA)
/** @type {Map<string, any>} */
const items = new Map()

for (const path of files) {
  const ext = extname(path).toLowerCase()
  const name = basename(path, extname(path))
  if (name.endsWith('.poster')) continue // a poster is a video's, not a picture of its own
  if (!STILL.has(ext) && !MOTION.has(ext)) continue

  const rel = relative(MEDIA, path).split(sep)
  const album = rel.length > 1 ? rel[0] : 'unfiled'
  const id = name
  if (items.has(id)) {
    console.error(`Two pictures want the id "${id}":`)
    console.error(`  ${items.get(id).src}`)
    console.error(`  ${path.split(sep).join('/')}`)
    console.error('Ids come from filenames and are the deep link — rename one.')
    process.exit(1)
  }

  const meta = sidecarOf(path)
  const motion = MOTION.has(ext)
  const poster = motion ? `${path.slice(0, -ext.length)}.poster.jpg` : null
  const size = measure(motion ? (poster && existsSync(poster) ? poster : path) : path) ??
    (meta.w && meta.h ? { w: meta.w, h: meta.h } : null)

  if (!size) {
    console.error(`Could not measure ${path} and its sidecar gives no w/h — skipping.`)
    continue
  }

  items.set(id, {
    id,
    album,
    kind: motion ? 'motion' : 'still',
    title: meta.title ?? titleOf(name),
    ...(meta.kana ? { kana: meta.kana } : {}),
    ...(meta.caption ? { caption: meta.caption } : {}),
    ...(meta.source ? { source: meta.source } : {}),
    ...(meta.shot ? { shot: meta.shot } : {}),
    src: '/' + relative('public', path).split(sep).join('/'),
    ...(poster && existsSync(poster) ? { poster: '/' + relative('public', poster).split(sep).join('/') } : {}),
    w: size.w,
    h: size.h,
    bytes: statSync(path).size,
    order: typeof meta.order === 'number' ? meta.order : Number.MAX_SAFE_INTEGER,
  })
}

const list = [...items.values()].sort(
  (a, b) => a.album.localeCompare(b.album) || a.order - b.order || a.id.localeCompare(b.id),
)

const albums = [...new Set(list.map((i) => i.album))].map((id) => ({
  id,
  count: list.filter((i) => i.album === id).length,
}))

const manifest = {
  generatedAt: new Date().toISOString(),
  counts: {
    items: list.length,
    stills: list.filter((i) => i.kind === 'still').length,
    motion: list.filter((i) => i.kind === 'motion').length,
    bytes: list.reduce((n, i) => n + i.bytes, 0),
  },
  albums,
  items: list.map(({ order: _order, ...item }) => item),
}

writeFileSync(OUT, JSON.stringify(manifest) + '\n')
console.log(
  `${OUT} — ${manifest.counts.items} pictures (${manifest.counts.stills} still, ${manifest.counts.motion} motion) ` +
    `across ${albums.length} album${albums.length === 1 ? '' : 's'}, ${(manifest.counts.bytes / 1e6).toFixed(1)} MB`,
)
