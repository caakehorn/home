/* ==========================================================================
   THE DARKROOM — a photograph off a phone becomes a plate in this building

   `public/art/README.md` states the rule the twelve cut plates were made
   under: nothing ships at source size. One original was 2099×2952 — 6.2
   megapixels of decode for something 380 px wide on screen — and everything
   in that folder is cut to roughly twice its largest on-page box and encoded
   as WebP. The folder is ~540 kB for twelve pictures.

   A drop-a-file-and-commit-it button breaks that rule on its first use. So
   this is what stands between the file picker and the repository: decode,
   downscale to a stated maximum edge, re-encode as WebP, and report both
   numbers so the person pressing the button can see what it cost.

   ---- what this is not ----------------------------------------------------

   It is not `scripts/build-art.mjs` and does not replace it. That script does
   three things this cannot: it finds letterbox crops by scanning for the
   longest run of non-black rows, it crops signatures and watermarks off
   rather than blurring them, and it floods inward from the border to give
   `kiss-uniform` a real alpha channel. All three are decisions about *what is
   in the frame*, they need `sharp`, and they belong in a script that is
   committed beside its output. This crops nothing. It resizes and re-encodes,
   which is the part a browser can do honestly.

   ---- the silent failure this exists to make loud --------------------------

   `canvas.toBlob(cb, 'image/webp')` does not throw on a browser that cannot
   encode WebP. It hands back a PNG. The blob is valid, the upload succeeds,
   and `public/art/thing.webp` is a PNG under a WebP name — three times the
   bytes, served with the wrong type, and nothing anywhere says so. Every
   conversion here checks `blob.type` against what was asked for and refuses
   rather than shipping the mislabelled file.
   ========================================================================== */

export type Converted = {
  /** The encoded picture, ready to commit. */
  blob: Blob
  /** Object URL for the preview. The caller revokes it. */
  preview: string
  w: number
  h: number
  bytes: number
  /** What it was called and what it weighed before any of this. */
  from: string
  fromBytes: number
  fromW: number
  fromH: number
  /** Whether any pixel is not fully opaque. A count, not a guess — see below. */
  alpha: boolean
  /** True when the source was already smaller than the maximum edge. */
  untouched: boolean
}

/** What the room offers. 1280 is the widest plate in `public/art` today. */
export const EDGES = [1600, 1280, 960, 640] as const

/** Anything above this is refused rather than committed. */
export const MAX_BYTES = 4_000_000

/** Above this the room says so. The whole existing folder is ~540 kB. */
export const HEAVY_BYTES = 409_600

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']

export const accepts = (type: string) => ACCEPTED.includes(type)

/**
 * Can this browser actually encode WebP?
 *
 * Probed once, on a 2×2 canvas, by asking for WebP and reading back what
 * arrived. Cached because the answer cannot change inside a session and the
 * room asks on every render.
 */
let webpProbe: Promise<boolean> | null = null
export function encodesWebp(): Promise<boolean> {
  webpProbe ??= new Promise<boolean>((resolve) => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 2
      canvas.height = 2
      canvas.toBlob((blob) => resolve(!!blob && blob.type === 'image/webp'), 'image/webp', 0.9)
    } catch {
      resolve(false)
    }
  })
  return webpProbe
}

/**
 * Decode a file to something drawable.
 *
 * `createImageBitmap` first, with `imageOrientation: 'from-image'` — a photo
 * off a phone carries its rotation in EXIF rather than in its pixels, and a
 * decode that ignores that commits a picture lying on its side. The `<img>`
 * fallback is for browsers that reject the option; it honours EXIF too, on
 * anything current.
 */
async function decode(file: File): Promise<{ source: CanvasImageSource; w: number; h: number }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { source: bitmap, w: bitmap.width, h: bitmap.height }
  } catch {
    /* fall through to the element */
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return { source: img, w: img.naturalWidth, h: img.naturalHeight }
  } finally {
    // The element holds its own decoded copy; the URL has done its job.
    URL.revokeObjectURL(url)
  }
}

/** Does any pixel carry transparency? Read off the canvas, not inferred from the type. */
function hasAlpha(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  try {
    const { data } = ctx.getImageData(0, 0, w, h)
    for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true
    return false
  } catch {
    // Only reachable on a tainted canvas, which a local File cannot cause.
    return false
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('the browser encoded nothing'))),
      type,
      quality,
    )
  })
}

/**
 * A picture, ready to hang.
 *
 * Never upscales: a 348×345 original stays 348×345, the way `kiss-blush` did
 * when it arrived that small and clean. Upscaling to hit a target edge only
 * softens the picture and triples the bytes.
 */
export async function convert(
  file: File,
  { maxEdge, quality }: { maxEdge: number; quality: number },
): Promise<Converted> {
  if (!accepts(file.type)) {
    throw new Error(
      `${file.type || 'that file'} is not a picture this can read — JPEG, PNG, WebP, GIF or AVIF`,
    )
  }
  if (!(await encodesWebp())) {
    throw new Error(
      'this browser cannot encode WebP, and committing a PNG under a .webp name is worse than ' +
        'not committing it. Convert it outside the browser and use scripts/build-art.mjs.',
    )
  }

  const { source, w: fromW, h: fromH } = await decode(file)
  if (!fromW || !fromH) throw new Error('that file decoded to nothing — it may be truncated')

  const scale = Math.min(1, maxEdge / Math.max(fromW, fromH))
  const w = Math.max(1, Math.round(fromW * scale))
  const h = Math.max(1, Math.round(fromH * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('this browser gave us no 2D context to draw into')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, w, h)
  if ('close' in source && typeof source.close === 'function') source.close()

  const alpha = hasAlpha(ctx, w, h)
  const blob = await toBlob(canvas, 'image/webp', quality)

  // The whole reason this module exists. `toBlob` degrades to PNG in silence.
  if (blob.type !== 'image/webp') {
    throw new Error(
      `asked for WebP and got ${blob.type} — this browser's encoder degraded silently, and the ` +
        'file would have been committed under the wrong extension',
    )
  }
  if (blob.size > MAX_BYTES) {
    throw new Error(
      `${(blob.size / 1e6).toFixed(1)} MB after conversion, and the cap is ` +
        `${MAX_BYTES / 1e6} MB. Try a smaller edge or a lower quality.`,
    )
  }

  return {
    blob,
    preview: URL.createObjectURL(blob),
    w,
    h,
    bytes: blob.size,
    from: file.name,
    fromBytes: file.size,
    fromW,
    fromH,
    alpha,
    untouched: scale === 1,
  }
}

/** Bytes, said the way a person reads them. */
export function weigh(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * A plate id from a filename.
 *
 * Lowercase, alphanumeric and hyphens, which is what `check-slates.mjs`
 * enforces and what the `public/art/` folder has always looked like.
 */
export function slugify(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** The bytes of a blob, base64'd for the GitHub blob API. */
export async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  // Chunked: `String.fromCharCode(...bytes)` on a megabyte blows the stack.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}
