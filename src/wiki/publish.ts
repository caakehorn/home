/**
 * Publishing — how an edit made in a browser becomes the wiki everyone sees.
 *
 * The portal is a static site with no server behind it, so there is nothing to
 * POST to. What there *is* is the repository the wiki actually lives in, and
 * GitHub's contents API, which will take a commit from anyone holding a token
 * with rights to it. So the browser commits.
 *
 *   1. The page's markdown goes to `caakehorn/wiki-brain`, which is the source
 *      of truth. Pictures go beside it under `wiki/assets/<slug>/`.
 *   2. A `repository_dispatch` fires this repo's sync workflow, which re-runs
 *      `sync-wiki.mjs` against the updated source, rebuilds the derived
 *      datasets and deploys.
 *
 * Writing to the source rather than to `public/wiki/` is the whole point: that
 * snapshot is a build artifact, and the next sync would overwrite anything
 * written into it. This way one edit survives every future rebuild, and the
 * derivation stays in the one script that has always owned it.
 *
 * The cost is a deploy cycle — an edit is live for everyone a minute or two
 * later, not instantly. The local draft keeps showing your version until then.
 */

const API = 'https://api.github.com'

export const SOURCE_REPO = 'caakehorn/wiki-brain'
export const SITE_REPO = 'caakehorn/home'

const TOKEN_KEY = 'danfrank:gh:token'

/**
 * The token lives in this tab by default and only reaches localStorage if you
 * ask it to. It is a write credential on a public site: keep it fine-grained
 * (contents: read and write on those two repositories, nothing else), and
 * throw it away with FORGET when you are done on a machine you do not own.
 */
export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string, remember: boolean) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
    if (remember) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* private mode: it just will not stick */
  }
}

export function forgetToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ditto */
  }
}

// ---------------------------------------------------------------------------

/**
 * A failed `fetch` throws a bare "Failed to fetch", which tells the person at
 * the keyboard nothing about whether they are offline, blocked, or looking at
 * a broken door. Name the condition instead.
 */
async function reach(url: string, init: RequestInit) {
  try {
    return await fetch(url, init)
  } catch {
    throw new Error('could not reach GitHub — offline, or something is blocking api.github.com')
  }
}

async function call(path: string, init: RequestInit = {}) {
  const token = getToken()
  if (!token) throw new Error('no token — add one before publishing')
  const res = await reach(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  if (res.status === 401) throw new Error('GitHub rejected the token (401) — it may be expired')
  if (res.status === 403) throw new Error('GitHub refused (403) — the token is missing contents: write')
  if (res.status === 404) throw new Error('not found (404) — check the token can see both repositories')
  if (!res.ok && res.status !== 204) {
    const detail = await res.text()
    throw new Error(`GitHub said ${res.status}: ${detail.slice(0, 200)}`)
  }
  return res.status === 204 ? null : res.json()
}

/** base64 of a UTF-8 string. `btoa` alone mangles kana, em dashes, everything. */
function encode(text: string) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  // Chunked: String.fromCharCode(...bytes) blows the argument limit on a
  // page-sized file.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

/** The current file's blob sha, or null when it does not exist yet. */
async function shaOf(repo: string, path: string, branch: string): Promise<string | null> {
  const token = getToken()
  const res = await reach(`${API}/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`could not read ${path} (${res.status})`)
  const body = await res.json()
  return Array.isArray(body) ? null : (body.sha as string)
}

const defaultBranches = new Map<string, string>()

async function branchOf(repo: string) {
  if (!defaultBranches.has(repo)) {
    const info = await call(`/repos/${repo}`)
    defaultBranches.set(repo, info.default_branch as string)
  }
  return defaultBranches.get(repo)!
}

async function putFile(repo: string, path: string, base64: string, message: string) {
  const branch = await branchOf(repo)
  const sha = await shaOf(repo, path, branch)
  const result = await call(`/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: base64, branch, ...(sha ? { sha } : {}) }),
  })
  return result.commit.html_url as string
}

/** Wake the sync workflow so the deployed snapshot catches up with the source. */
async function dispatch(repo: string, slug: string) {
  await call(`/repos/${repo}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({ event_type: 'wiki-updated', client_payload: { slug } }),
  })
}

// ---------------------------------------------------------------------------
// pictures

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

/** Every `upload:<id>` handle a page's markdown still refers to. */
export function uploadsIn(markdown: string): string[] {
  return [...new Set([...markdown.matchAll(/upload:([\w.-]+)/g)].map((m) => m[1]))]
}

/** Where a published picture lands, in both repos. */
export const assetPath = (slug: string, id: string, ext: string) => `assets/${slug}/${id}.${ext}`

type Progress = (note: string) => void

/**
 * Commit a page and everything it points at, then ask the site to rebuild.
 *
 * Pictures go first: the markdown is rewritten to point at their committed
 * paths, so the page is never in the repository referring to a `upload:`
 * handle that only exists in one browser's localStorage.
 */
export async function publishPage(
  {
    slug,
    markdown,
    images,
  }: {
    slug: string
    markdown: string
    /** `upload:<id>` → the data URL held in this browser. */
    images: Record<string, string>
  },
  onProgress: Progress = () => {},
): Promise<{ commit: string; pictures: number }> {
  let source = markdown
  const handles = uploadsIn(markdown)
  let pictures = 0

  for (const id of handles) {
    const dataUrl = images[id]
    if (!dataUrl) continue
    const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/)
    if (!match) continue
    const [, mime, base64] = match
    const ext = EXT[mime] ?? 'bin'
    const path = assetPath(slug, id, ext)

    pictures++
    onProgress(`uploading picture ${pictures} of ${handles.length}…`)
    await putFile(SOURCE_REPO, `wiki/${path}`, base64, `Add a picture to ${slug}`)
    source = source.split(`upload:${id}`).join(path)
  }

  onProgress('committing the page…')
  const commit = await putFile(
    SOURCE_REPO,
    `wiki/${slug}.md`,
    encode(source),
    `Edit ${slug} from the portal`,
  )

  onProgress('asking the site to rebuild…')
  // The commit is the durable part. If the nudge fails the edit is still
  // upstream and the next scheduled sync will pick it up, so say what
  // happened rather than reporting a failure that did not lose anything.
  try {
    await dispatch(SITE_REPO, slug)
  } catch {
    onProgress('published — the rebuild will run on its next scheduled pass')
  }

  return { commit, pictures }
}
