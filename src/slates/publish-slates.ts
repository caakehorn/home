/* ==========================================================================
   COMMITTING A PLATE — a picture and the row that names it, in one commit

   Same arrangement as `src/blog/publish-blog.ts` and `src/wiki/publish.ts`:
   this is a static site with nothing to POST to, so the browser commits to
   the repository the site is built from, with a token from the keyring —
   shipped encrypted in the deploy and opened by the passphrase the door
   already asked for.

   ---- why this one does not use the contents API ---------------------------

   Both of those write one file per call. Two files means two commits, and the
   two files here are a picture in `public/art/` and the row in
   `src/content/board.json` that names it. A tree that has the row without the
   picture is exactly what `scripts/check-slates.mjs` exits 1 on, so writing
   them one at a time means either a broken intermediate commit or an ordering
   rule held by hand forever. It also means two pushes, two deploy runs, and a
   queue.

   So this goes through the git data API instead — blob, tree, commit, ref —
   which is five calls and one commit containing both files. The intermediate
   state does not exist rather than being tolerated.

   ---- what happens when somebody else pushed first -------------------------

   The ref update is not forced. A `main` that moved between reading the head
   and writing it comes back 422, and the whole thing is retried once from the
   new head: the tree is rebuilt on the new base, so the other push survives.
   A second failure is reported rather than forced — a forced push from a
   dashboard is not a thing this building should be able to do.
   ========================================================================== */

import { configured, credential as fromKeyring } from '../wiki/keyring'
import type { Board } from '../content/slates'

const API = 'https://api.github.com'

export const SITE_REPO = 'caakehorn/home'
export const BOARD_PATH = 'src/content/board.json'
export const ART_DIR = 'public/art'

type Progress = (note: string) => void

/** One file, on its way into a commit. `null` bytes means delete it. */
export type Write = { path: string; base64: string | null }

async function credential(): Promise<string> {
  const token = await fromKeyring()
  if (token) return token
  throw new Error(
    (await configured())
      ? 'this tab has no passphrase — reload and come in through the door'
      : 'no keyring on this deploy — run `npm run keyring` and push',
  )
}

async function reach(url: string, init: RequestInit) {
  try {
    return await fetch(url, init)
  } catch {
    throw new Error('could not reach GitHub — offline, or something is blocking api.github.com')
  }
}

async function call(token: string, path: string, init: RequestInit = {}) {
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
  if (res.status === 401)
    throw new Error('GitHub rejected the keyring token (401) — it expired; re-run `npm run keyring`')
  if (res.status === 403)
    throw new Error('GitHub refused (403) — the keyring token is missing Contents: write')
  if (!res.ok && res.status !== 204) {
    throw new Error(`GitHub said ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  return res.status === 204 ? null : res.json()
}

const utf8 = (text: string): string => {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

const fromUtf8 = (base64: string): string =>
  new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)))

/* --------------------------------------------------------------------------
   Reading what is actually committed
   -------------------------------------------------------------------------- */

/**
 * The board as the repository has it, which is not always the board this page
 * was built with.
 *
 * A deploy takes a minute or two. Between pressing save and the site coming
 * back up, the bundled `board.json` is one behind — and a dashboard that
 * edits the bundled copy would silently undo the previous save. So the room
 * reads this before it lets anybody change anything, and says which of the
 * two it is showing.
 */
export async function readBoard(): Promise<{ board: Board; sha: string } | null> {
  const token = await credential()
  const res = await reach(`${API}/repos/${SITE_REPO}/contents/${BOARD_PATH}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      // The API caches aggressively behind a CDN and a board read one second
      // after a commit is exactly the case that matters here.
      'Cache-Control': 'no-cache',
    },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`could not read ${BOARD_PATH} (${res.status})`)
  const body = await res.json()
  return { board: JSON.parse(fromUtf8(body.content.replace(/\n/g, ''))) as Board, sha: body.sha }
}

/** Every file already in `public/art/`, so the room can refuse to overwrite one. */
export async function listArt(): Promise<string[]> {
  const token = await credential()
  const body = await call(token, `/repos/${SITE_REPO}/contents/${ART_DIR}`)
  return Array.isArray(body) ? body.map((f: { name: string }) => f.name) : []
}

/* --------------------------------------------------------------------------
   Writing
   -------------------------------------------------------------------------- */

async function commitOnce(
  token: string,
  branch: string,
  writes: Write[],
  message: string,
  onProgress: Progress,
): Promise<{ ok: true; url: string } | { ok: false }> {
  const ref = await call(token, `/repos/${SITE_REPO}/git/ref/heads/${branch}`)
  const head = ref.object.sha as string
  const parent = await call(token, `/repos/${SITE_REPO}/git/commits/${head}`)

  const tree: Record<string, unknown>[] = []
  for (const write of writes) {
    if (write.base64 === null) {
      // A null sha in a tree entry is how the git data API says "remove this".
      tree.push({ path: write.path, mode: '100644', type: 'blob', sha: null })
      continue
    }
    onProgress(`uploading ${write.path.split('/').pop()}…`)
    const blob = await call(token, `/repos/${SITE_REPO}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: write.base64, encoding: 'base64' }),
    })
    tree.push({ path: write.path, mode: '100644', type: 'blob', sha: blob.sha })
  }

  onProgress('building the tree…')
  const built = await call(token, `/repos/${SITE_REPO}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: parent.tree.sha, tree }),
  })

  onProgress('committing…')
  const commit = await call(token, `/repos/${SITE_REPO}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: built.sha, parents: [head] }),
  })

  const res = await reach(`${API}/repos/${SITE_REPO}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sha: commit.sha, force: false }),
  })
  // 422 is the documented answer to a non-fast-forward update: somebody
  // pushed between the read and the write.
  if (res.status === 422) return { ok: false }
  if (!res.ok) throw new Error(`GitHub said ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return { ok: true, url: commit.html_url as string }
}

/**
 * Put a set of files into one commit on the default branch.
 *
 * Returns the commit URL. Every caller in the room goes through here, so
 * there is one place that knows how a plate reaches the repository.
 */
export async function commitFiles(
  writes: Write[],
  message: string,
  onProgress: Progress = () => {},
): Promise<string> {
  const token = await credential()
  onProgress('finding the branch…')
  const repo = await call(token, `/repos/${SITE_REPO}`)
  const branch = repo.default_branch as string

  let result = await commitOnce(token, branch, writes, message, onProgress)
  if (!result.ok) {
    onProgress(`${branch} moved under us — rebuilding on the new head…`)
    result = await commitOnce(token, branch, writes, message, onProgress)
  }
  if (!result.ok) {
    throw new Error(
      `${branch} moved twice while this was committing. Nothing was written and nothing was ` +
        'lost — reload the room and try again.',
    )
  }

  onProgress('asking the site to rebuild…')
  try {
    await call(token, `/repos/${SITE_REPO}/dispatches`, {
      method: 'POST',
      body: JSON.stringify({ event_type: 'deploy', client_payload: { what: 'slates' } }),
    })
  } catch {
    onProgress('committed — the deploy will run on its next scheduled pass')
  }
  return result.url
}

/**
 * The board, serialised the way the file in the repository is written.
 *
 * Two spaces and a trailing newline, so a save that changes one assignment
 * produces a one-line diff rather than reformatting the file. Key order is
 * fixed here rather than left to insertion order for the same reason.
 */
export function serialise(board: Board): string {
  const walls: Record<string, string> = {}
  for (const key of Object.keys(board.walls ?? {}).sort()) walls[key] = board.walls[key]
  const pools: Record<string, string[]> = {}
  for (const key of Object.keys(board.pools ?? {}).sort()) pools[key] = board.pools[key]
  return `${JSON.stringify(
    {
      note: board.note ?? 'Written by THE SLATE ROOM at /slates. Hand-editable, but the room is the front door.',
      plates: board.plates ?? [],
      walls,
      pools,
    },
    null,
    2,
  )}\n`
}

/** Save the board on its own — an assignment changed, no new picture. */
export function commitBoard(board: Board, message: string, onProgress?: Progress) {
  return commitFiles([{ path: BOARD_PATH, base64: utf8(serialise(board)) }], message, onProgress)
}

/**
 * Save the board and a new picture together.
 *
 * The order in the array is irrelevant — it is one tree — which is the whole
 * point of doing it this way.
 */
export function commitPlate(
  board: Board,
  picture: { file: string; base64: string },
  message: string,
  onProgress?: Progress,
) {
  return commitFiles(
    [
      { path: `${ART_DIR}/${picture.file}`, base64: picture.base64 },
      { path: BOARD_PATH, base64: utf8(serialise(board)) },
    ],
    message,
    onProgress,
  )
}

/** Take a picture down: the file goes, and so does every reference to it. */
export function commitRemoval(
  board: Board,
  file: string,
  message: string,
  onProgress?: Progress,
) {
  return commitFiles(
    [
      { path: `${ART_DIR}/${file}`, base64: null },
      { path: BOARD_PATH, base64: utf8(serialise(board)) },
    ],
    message,
    onProgress,
  )
}
