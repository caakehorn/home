/**
 * TRANSMISSIONS — the blog.
 *
 * Posts are markdown files in `./posts`, with a small frontmatter block. They
 * are bundled at build time rather than fetched, because there are going to be
 * dozens of them and not thousands: a zine is not a corpus, and the wiki is
 * already the thing that handles a corpus.
 *
 * The renderer is the wiki's, unchanged — same markdown, same charts out of
 * tables, same `[[wiki/…]]` links straight into the brain. A post is allowed to
 * be a page of the same organism.
 */

export type Tone = 1 | 2 | 3 | 4 | 5

export type Post = {
  slug: string
  title: string
  /** ISO yyyy-mm-dd. Sorted on, printed as-is. */
  date: string
  /** The standfirst. One sentence, on the card and under the headline. */
  dek: string
  tags: string[]
  kana: string
  tone: Tone
  /** Markdown, frontmatter stripped. */
  body: string
  words: number
  minutes: number
}

/** `---\nkey: value\n---\n` — enough YAML to describe a post and no more. */
function frontmatter(source: string): [Record<string, string>, string] {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source)
  if (!match) return [{}, source]

  const fields: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const at = line.indexOf(':')
    if (at < 1) continue
    fields[line.slice(0, at).trim()] = line
      .slice(at + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
  }
  return [fields, source.slice(match[0].length)]
}

const toneOf = (raw: string | undefined): Tone => {
  const n = Number(raw)
  return n >= 1 && n <= 5 ? ((n | 0) as Tone) : 5
}

const RAW = import.meta.glob('./posts/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export const POSTS: Post[] = Object.entries(RAW)
  .map(([path, source]) => {
    const [meta, body] = frontmatter(source)
    const slug = meta.slug ?? path.replace(/^.*\/|\.md$/g, '')
    const words = body.split(/\s+/).filter(Boolean).length
    return {
      slug,
      title: meta.title ?? slug,
      date: meta.date ?? '',
      dek: meta.dek ?? '',
      tags: (meta.tags ?? '')
        .split(/[,·]/)
        .map((tag) => tag.trim().toUpperCase())
        .filter(Boolean),
      kana: meta.kana ?? '通信',
      tone: toneOf(meta.tone),
      body: body.trim(),
      words,
      // 220wpm, rounded up. Nobody reads a transmission at 220wpm, but the
      // number is a promise about length and that is all it has to be.
      minutes: Math.max(1, Math.round(words / 220)),
    }
  })
  // Newest first. A tie breaks on slug so the order is stable across builds.
  .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))

export const postBySlug = (slug: string) => POSTS.find((post) => post.slug === slug)

/** Every tag in the archive, commonest first. */
export const TAGS: { tag: string; count: number }[] = Object.entries(
  POSTS.reduce<Record<string, number>>((counts, post) => {
    for (const tag of post.tags) counts[tag] = (counts[tag] ?? 0) + 1
    return counts
  }, {}),
)
  .map(([tag, count]) => ({ tag, count }))
  .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))

/** Reading order is newest-first, so "next" is the older post. */
export function neighbours(slug: string) {
  const at = POSTS.findIndex((post) => post.slug === slug)
  return {
    newer: at > 0 ? POSTS[at - 1] : null,
    older: at >= 0 && at < POSTS.length - 1 ? POSTS[at + 1] : null,
  }
}

/** 2026-02-11 → 11 FEB 2026. Parsed by hand: `new Date` would shift the day. */
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export function stamp(date: string) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!parts) return date
  return `${Number(parts[3])} ${MONTHS[Number(parts[2]) - 1] ?? '???'} ${parts[1]}`
}
