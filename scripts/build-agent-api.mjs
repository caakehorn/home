/**
 * The agent surface: what a crawler or an LLM reads instead of the site.
 *
 *   node --experimental-strip-types scripts/build-agent-api.mjs
 *
 * The portal renders 458 wiki pages through a React app behind a gate. None of
 * that is any use to a machine: an agent wants to find the entry it needs and
 * read it, in as few hops as possible, without executing a single line of
 * JavaScript. So the same corpus is emitted a second way.
 *
 *   /llms.txt              the entry point — what this is, and every endpoint
 *   /llms-full.txt         the whole corpus as one markdown stream
 *   /agent/manifest.json   the contract: endpoints, slug rules, field meanings
 *   /agent/search.json     one compact record per page, plus an alias lookup
 *
 * All four are generated at build time and none are committed: they are
 * derived from `public/wiki/`, they change whenever any page does, and a 3 MB
 * text file rewritten on every sync would bloat the repository for nothing.
 *
 * The page JSON the site already serves is the read endpoint — there is no
 * second copy of the prose to drift out of date, and an agent that has found a
 * slug reads exactly what the site reads.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseBrief, segmentBriefs } from '../src/wiki/brief.ts'

const PAGES = 'public/wiki/pages'
const OUT = 'public'
const SITE = 'https://caakehorn.github.io'
const BASE = (process.env.BASE_PATH ?? '/').replace(/\/*$/, '/')
const url = (path) => `${SITE}${BASE}${path}`.replace(/([^:])\/{2,}/g, '$1/')

const index = JSON.parse(readFileSync('public/wiki/index.json', 'utf8'))
// A sealed page is a ciphertext in the snapshot and has no business in an
// endpoint whose whole purpose is handing the corpus to a machine that will not
// be typing a passphrase. It is dropped here rather than emitted empty: a
// listing with a title, a URL and nothing to read is an invitation to ask why.
const pages = readdirSync(PAGES)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(PAGES, f), 'utf8')))
  .filter((p) => !p.locked)
  .sort((a, b) => a.slug.localeCompare(b.slug))

// ---------------------------------------------------------------------------
// helpers

/** `[a, b]` and `["a", "b"]` are both in the wild in this corpus. */
function listOf(value) {
  if (!value) return []
  const trimmed = String(value).trim()
  if (!/^\[.*\]$/.test(trimmed)) return [trimmed]
  return trimmed
    .slice(1, -1)
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
}

/** Markdown down to something a summary can be cut from. */
const plain = (md) =>
  md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s+.*$/gm, ' ')
    .replace(/^\s*\|.*$/gm, ' ')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_a, target, label) => label || target.split('/').pop())
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * What this page is, in one line.
 *
 * A page carrying an LLM Quick Brief already has a summary written to be read
 * by a machine — that is exactly what it is for, so it wins. Otherwise the
 * opening prose is cut at a sentence boundary.
 */
function summarise(page, limit = 260) {
  for (const segment of segmentBriefs(page.body)) {
    if (segment.kind !== 'brief') continue
    const first = plain(segment.brief.facts.map((f) => f.text).join(' '))
    if (first) return clip(first, limit)
  }
  // Some briefs are rejected by the visualiser (a table, a list) but still
  // read as a summary; take the block's own prose before falling back.
  const heading = page.body.match(/^#{2,4}\s+.*(quick brief|context injection|tl;?\s?dr)/im)
  if (heading) {
    const after = page.body.slice(page.body.indexOf(heading[0]) + heading[0].length)
    const text = plain(after.split(/\n#{1,6}\s/)[0])
    if (text) return clip(text, limit)
  }
  return clip(plain(page.body), limit)
}

function clip(text, limit) {
  if (text.length <= limit) return text
  const cut = text.slice(0, limit)
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '))
  return (stop > limit * 0.5 ? cut.slice(0, stop + 1) : `${cut.trimEnd()}…`).trim()
}

// ---------------------------------------------------------------------------
// /agent/search.json — find the entry

const records = pages.map((page) => {
  const entry = index.pages.find((p) => p.slug === page.slug) ?? {}
  return {
    slug: page.slug,
    title: page.title,
    domain: page.domain,
    type: page.meta.page_type ?? null,
    status: page.meta.status ?? null,
    importance: page.meta.importance ?? null,
    aliases: listOf(page.meta.aliases),
    tags: listOf(page.meta.tags),
    // Infobox prose is written for the page, so it still carries [[wiki links]].
    knownFor: plain(page.infobox?.known_for ?? entry.knownFor ?? '') || null,
    summary: summarise(page),
    words: page.words,
    updated: page.meta.date_modified ?? null,
    links: page.links.length,
    backlinks: page.backlinks.length,
    brief: Boolean(entry.brief),
  }
})

/**
 * Name → slug, so "Annie" or "@Lo_weez" resolves in one hop instead of a scan.
 * Titles and aliases both; the first claim on a name wins, and pages are in
 * slug order, so it is stable across builds rather than dependent on which
 * file was read first.
 */
const lookup = {}
for (const record of records) {
  for (const name of [record.title, ...record.aliases]) {
    const key = name.toLowerCase().trim()
    if (key && !(key in lookup)) lookup[key] = record.slug
  }
}

// ---------------------------------------------------------------------------
// /agent/manifest.json — the contract

const manifest = {
  name: "Dan's Dialectical Database and Drug Den — wiki-brain",
  description:
    'A personal wiki of 458 interlinked pages: people, timeline, places, work, ' +
    'interests, and synthesis. This manifest describes how to read it without ' +
    'rendering the site.',
  version: 1,
  generatedAt: new Date().toISOString(),
  source: 'https://github.com/caakehorn/wiki-brain',
  counts: {
    pages: index.counts.pages,
    words: index.counts.words,
    links: index.counts.edges ?? null,
    domains: index.domains.length,
  },
  domains: index.domains,
  endpoints: {
    entry: url('llms.txt'),
    manifest: url('agent/manifest.json'),
    corpus: url('llms-full.txt'),
    search: url('agent/search.json'),
    index: url('wiki/index.json'),
    page: `${url('wiki/pages/')}{slug}.json`,
    human: `${url('brain/')}{slug}`,
  },
  /** The one rule an agent has to know to turn a slug into a URL. */
  slugEncoding: {
    rule: "replace every '/' in the slug with '__'",
    example: { slug: 'people/annie-ulmer', file: 'people__annie-ulmer.json' },
  },
  fields: {
    'page.slug': 'Stable id and path, e.g. "people/annie-ulmer".',
    'page.title': 'Display title.',
    'page.domain': 'Top-level section: the first slug segment.',
    'page.meta': 'Frontmatter as written: page_type, status, tags, aliases, dates, importance.',
    'page.infobox': 'Key/value summary box, when the page has one.',
    'page.lists': 'Frontmatter list blocks: sources, related, connections, changelog.',
    'page.links': 'Slugs this page links to.',
    'page.backlinks': 'Slugs that link to this page.',
    'page.body': 'The page itself, as markdown. Wiki links are [[wiki/<slug>|label]].',
    'search.summary': 'One-line abstract — the page\'s own LLM Quick Brief where it has one.',
    'search.lookup': 'name (lowercased) → slug, covering titles and aliases.',
  },
  notes: [
    'Everything is static JSON and text. No API key, no rendering, no JavaScript.',
    'The site itself sits behind a client-side gate; these endpoints do not.',
    'Content is a personal archive and includes named living people. It is ' +
      'documentary and opinionated, not a reference work — attribute it as one person\'s record.',
  ],
}

// ---------------------------------------------------------------------------
// /llms.txt — the entry point

const byDomain = new Map()
for (const record of records) {
  if (!byDomain.has(record.domain)) byDomain.set(record.domain, [])
  byDomain.get(record.domain).push(record)
}

/** The pages worth naming: most linked-to first, which is the corpus's own vote. */
const notable = (list, n) =>
  [...list].sort((a, b) => b.backlinks - a.backlinks || b.words - a.words).slice(0, n)

const lines = [
  "# Dan's Dialectical Database and Drug Den — wiki-brain",
  '',
  `> ${manifest.description}`,
  '',
  `${manifest.counts.pages} pages · ${manifest.counts.words.toLocaleString()} words · ` +
    `${manifest.counts.links?.toLocaleString() ?? '?'} links between them. ` +
    `Generated ${manifest.generatedAt.slice(0, 10)} from ${manifest.source}.`,
  '',
  '## Reading this without rendering the site',
  '',
  `- [Manifest](${manifest.endpoints.manifest}): endpoints, slug rules, field meanings. Start here.`,
  `- [Search index](${manifest.endpoints.search}): one record per page — title, aliases, tags, a one-line summary — plus a name → slug lookup.`,
  `- [Page index](${manifest.endpoints.index}): every page with counts and map coordinates.`,
  `- [Whole corpus](${manifest.endpoints.corpus}): every page as one markdown stream, for one-shot ingestion.`,
  '',
  `A page is read at \`${manifest.endpoints.page}\`, where \`{slug}\` has its slashes replaced by \`__\` ` +
    `(\`people/annie-ulmer\` → \`people__annie-ulmer.json\`). Its \`body\` is markdown. ` +
    `The same page is human-readable at \`${manifest.endpoints.human}\`.`,
  '',
  '## What is in it',
  '',
]

for (const [domain, list] of [...byDomain].sort((a, b) => b[1].length - a[1].length)) {
  lines.push(`### ${domain} (${list.length} pages)`)
  lines.push('')
  for (const record of notable(list, 8)) {
    const note = record.knownFor || record.summary
    lines.push(`- [${record.title}](${url(`wiki/pages/${record.slug.replace(/\//g, '__')}.json`)}): ${clip(note, 160)}`)
  }
  lines.push('')
}

lines.push('## Notes')
lines.push('')
for (const note of manifest.notes) lines.push(`- ${note}`)
lines.push('')

// ---------------------------------------------------------------------------
// /llms-full.txt — everything, in one stream

const full = [
  "# Dan's Dialectical Database and Drug Den — wiki-brain, complete",
  ``,
  `${manifest.counts.pages} pages, ${manifest.counts.words.toLocaleString()} words, generated ${manifest.generatedAt}.`,
  `Source: ${manifest.source}. Each page below is delimited by a level-1 heading and its slug.`,
  ``,
]

for (const page of pages) {
  const record = records.find((r) => r.slug === page.slug)
  full.push('---')
  full.push('')
  full.push(`# ${page.title}`)
  full.push('')
  full.push(`slug: ${page.slug}`)
  full.push(`url: ${url(`brain/${page.slug}`)}`)
  if (record.aliases.length) full.push(`aliases: ${record.aliases.join(', ')}`)
  if (record.tags.length) full.push(`tags: ${record.tags.join(', ')}`)
  if (record.updated) full.push(`updated: ${record.updated}`)
  if (page.links.length) full.push(`links: ${page.links.join(', ')}`)
  full.push('')
  full.push(page.body.trim())
  full.push('')
}

// ---------------------------------------------------------------------------

mkdirSync(join(OUT, 'agent'), { recursive: true })
writeFileSync(join(OUT, 'agent', 'manifest.json'), JSON.stringify(manifest, null, 2))
writeFileSync(join(OUT, 'agent', 'search.json'), JSON.stringify({ generatedAt: manifest.generatedAt, pages: records, lookup }))
writeFileSync(join(OUT, 'llms.txt'), lines.join('\n'))
writeFileSync(join(OUT, 'llms-full.txt'), full.join('\n'))

const kb = (s) => `${Math.round(s / 1024).toLocaleString()} kB`
console.log(
  `agent: ${records.length} records · ${Object.keys(lookup).length} names -> ` +
    `llms.txt (${kb(lines.join('\n').length)}), llms-full.txt (${kb(full.join('\n').length)}), ` +
    `agent/search.json (${kb(JSON.stringify(records).length)}), agent/manifest.json`,
)
