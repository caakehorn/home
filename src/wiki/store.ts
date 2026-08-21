/**
 * Local edit store.
 *
 * The portal is a static site — there is no server to write to. Edits and
 * uploaded pictures therefore live in this browser, keyed by page slug, and
 * are exported as a .md file when you want them back in the wiki-brain repo.
 * Viewing a page always prefers the local draft over the shipped snapshot,
 * so an edit persists across reloads and navigation.
 */

const DRAFTS = 'danfrank:wiki:drafts:v1'
const IMAGES = 'danfrank:wiki:images:v1'

/**
 * The keys were namespaced to the old name of this place. Renaming them would
 * strand any draft that had not been published yet, so anything found under
 * the old key is moved across once, on first read, and the old key dropped.
 */
function migrate() {
  for (const [from, to] of [
    ['moonlight-inn:wiki:drafts:v1', DRAFTS],
    ['moonlight-inn:wiki:images:v1', IMAGES],
  ]) {
    try {
      const old = localStorage.getItem(from)
      if (old === null) continue
      if (localStorage.getItem(to) === null) localStorage.setItem(to, old)
      localStorage.removeItem(from)
    } catch {
      /* private mode, or a quota that will not take the copy */
    }
  }
}

migrate()

export type Draft = {
  slug: string
  source: string
  savedAt: string
  /**
   * The upstream `date_modified` this draft was forked from.
   *
   * Not decoration — this is what makes a lost update detectable. See
   * `draftIsStale`. Optional because drafts written before this field existed
   * are still sitting in browsers; those fall back to the `date_modified`
   * inside their own frontmatter, which is the same value by another route.
   */
  base?: string
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    // Quota is the realistic failure here; the caller surfaces it.
    return false
  }
}

export const allDrafts = () => read<Record<string, Draft>>(DRAFTS, {})
export const getDraft = (slug: string): Draft | null => allDrafts()[slug] ?? null

export function saveDraft(slug: string, source: string, base?: string) {
  const drafts = allDrafts()
  // The base is recorded once, when the draft first appears. Re-stamping it on
  // every autosave would quietly re-baseline a draft against whatever upstream
  // happens to be at the moment you typed a character, which is precisely the
  // check `draftIsStale` exists to make.
  const existing = drafts[slug]
  drafts[slug] = {
    slug,
    source,
    savedAt: new Date().toISOString(),
    base: existing?.base ?? base,
  }
  return write(DRAFTS, drafts)
}

/** The `date_modified` written in a markdown frontmatter block, if it has one. */
function modifiedIn(source: string): string | null {
  const end = source.startsWith('---') ? source.indexOf('\n---', 3) : -1
  const head = end === -1 ? source.slice(0, 2000) : source.slice(0, end)
  return head.match(/^date_modified:\s*["']?([\d-]+)/m)?.[1] ?? null
}

/**
 * Has upstream moved since this draft was forked from it?
 *
 * A draft used to win over the shipped snapshot unconditionally, and on
 * 2026-08-21 that cost the wiki 30KB of prose, an infobox and 56 typed-edge
 * claims: a browser holding a draft of `people/annie-ulmer` taken on 08-13
 * published it over three later passes, and the only visible symptom was two
 * frontmatter dates moving *backwards* in the commit. Nothing in this app
 * noticed, because nothing was looking.
 *
 * `date_modified` is the comparison rather than `savedAt` because `savedAt` is
 * when the browser last wrote the draft, which says nothing about how old the
 * page it was forked from is — a draft typed this morning off a month-old
 * snapshot is exactly the dangerous case, and its `savedAt` looks fresh.
 *
 * Day granularity, and strictly-greater on purpose: two edits on the same day
 * are the ordinary case and must not raise this.
 */
export function draftIsStale(draft: Draft, upstreamModified?: string | null): boolean {
  if (!upstreamModified) return false
  const base = draft.base ?? modifiedIn(draft.source)
  if (!base) return false
  return upstreamModified > base
}

export function discardDraft(slug: string) {
  const drafts = allDrafts()
  delete drafts[slug]
  write(DRAFTS, drafts)
}

export const allImages = () => read<Record<string, string>>(IMAGES, {})
export const getImage = (id: string): string | null => allImages()[id] ?? null

export function saveImage(id: string, dataUrl: string) {
  const images = allImages()
  images[id] = dataUrl
  return write(IMAGES, images)
}

/**
 * localStorage tops out around 5MB, so a phone photo cannot go in raw.
 * Downscale to fit a box and re-encode before storing.
 */
export function downscaleImage(file: File, max = 720): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('could not read that file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('that file is not an image the browser can decode'))
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('canvas unavailable'))
        ctx.drawImage(img, 0, 0, w, h)
        // PNG for anything with transparency, JPEG otherwise — much smaller.
        const type = file.type === 'image/png' || file.type === 'image/svg+xml' ? 'image/png' : 'image/jpeg'
        resolve(canvas.toDataURL(type, 0.82))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

/** Rebuild a full .md file (frontmatter + body) from an edited page. */
export function toMarkdown(frontmatter: string, body: string) {
  const fm = frontmatter.trim()
  return `---\n${fm}\n---\n\n${body.trimStart()}`
}

export function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
