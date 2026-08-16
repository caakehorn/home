/**
 * Publishing — committing a transmission to this repository.
 *
 * Blog posts live in `src/blog/posts/` as markdown files bundled at build
 * time. The writing dashboard writes a new file there and commits it through
 * the GitHub Contents API, then fires `repository_dispatch` to trigger a
 * deploy. The site rebuilds with the new post and serves it on /blog.
 *
 * The credential comes from the keyring — same passphrase as the gate.
 */

import { configured, credential as fromKeyring } from '../wiki/keyring'

const API = 'https://api.github.com'

export const SITE_REPO = 'caakehorn/home'

/**
 * Build the full markdown file content from frontmatter + body.
 */
export function toMarkdown(meta: {
  title: string
  slug: string
  date: string
  dek: string
  tags: string
  kana: string
  tone: number
}, body: string): string {
  const lines = [
    '---',
    `title: ${meta.title}`,
    `slug: ${meta.slug}`,
    `date: ${meta.date}`,
    `dek: ${meta.dek}`,
    `tags: ${meta.tags}`,
    `kana: ${meta.kana || '通信'}`,
    `tone: ${meta.tone || 5}`,
    '---',
    '',
    body.trim(),
    '',
  ]
  return lines.join('\n')
}

/**
 * Generate a slug from a title. Lowercase, alphanumeric + hyphens.
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function encode(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
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
    const detail = await res.text()
    throw new Error(`GitHub said ${res.status}: ${detail.slice(0, 200)}`)
  }
  return res.status === 204 ? null : res.json()
}

async function branchOf(token: string, repo: string): Promise<string> {
  const info = await call(token, `/repos/${repo}`)
  return info.default_branch as string
}

async function shaOf(token: string, repo: string, path: string, branch: string): Promise<string | null> {
  const res = await reach(
    `${API}/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  )
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`could not read ${path} (${res.status})`)
  const body = await res.json()
  return Array.isArray(body) ? null : (body.sha as string)
}

/**
 * Commit a post file to the repository.
 *
 * Returns the commit URL.
 */
export async function publishPost(
  meta: { title: string; slug: string; date: string; dek: string; tags: string; kana: string; tone: number },
  body: string,
  onProgress: (note: string) => void,
): Promise<string> {
  const token = await fromKeyring()
  if (!token) {
    const hasKeyring = await configured()
    throw new Error(
      hasKeyring
        ? 'this tab has no passphrase — reload and come in through the door'
        : 'no keyring on this deploy — run `npm run keyring` and push',
    )
  }

  const path = `src/blog/posts/${meta.slug}.md`
  const markdown = toMarkdown(meta, body)

  onProgress('finding the branch…')
  const branch = await branchOf(token, SITE_REPO)
  const sha = await shaOf(token, SITE_REPO, path, branch)

  onProgress(sha ? 'updating the post…' : 'creating the post…')
  const result = await call(token, `/repos/${SITE_REPO}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: sha ? `Edit ${meta.slug}` : `Add ${meta.slug}`,
      content: encode(markdown),
      branch,
      ...(sha ? { sha } : {}),
    }),
  })

  const commitUrl = result.commit.html_url as string

  onProgress('asking the site to rebuild…')
  try {
    await call(token, `/repos/${SITE_REPO}/dispatches`, {
      method: 'POST',
      body: JSON.stringify({ event_type: 'deploy', client_payload: { slug: meta.slug } }),
    })
  } catch {
    onProgress('committed — the deploy will run on its next scheduled pass')
  }

  return commitUrl
}
