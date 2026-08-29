/**
 * The front-matter reader THE CORE needs, and nothing more.
 *
 * ---- why this is not a YAML parser ----------------------------------------
 *
 * The one thing this build must not lose is the typed connection graph: 2,398
 * `{page, type, claim}` entries that exist *only* in each page's raw
 * front-matter. `lists.connections` in the page JSON flattens every entry to
 * the string `"page: …"` and drops both the type and the claim, so reading that
 * field instead would silently discard the entire point of the instrument.
 *
 * The obvious move is `yaml.parse(fmRaw)`. It is the wrong one twice over.
 * First it adds a dependency to a repository that has kept itself at four.
 * Second, and worse, one page — `mind/synthesis/august-grievance-verdict` —
 * has a block-scalar error at line 12 that makes a strict parser throw, and a
 * parser that throws on one page in five hundred is a parser that loses twelve
 * real edges to a typo somebody made once.
 *
 * So this reads the block by line instead, and a survey of all 519 pages says
 * that is not a compromise:
 *
 *   404 pages carry `connections:`  ·  every item is indented exactly two
 *   spaces  ·  2,398 items in total  ·  **zero** values wrap onto a second line
 *
 * Uniform input means one code path with no fallback, and malformed YAML
 * elsewhere in the block cannot cost an edge because the block is never handed
 * to a parser that cares. The reader is deliberately narrow: it will not
 * survive a corpus that starts wrapping its claims, and `readConnections`
 * reports what it found so the build can refuse to write if the shape moves.
 */

/** Strip one layer of YAML quoting, and nothing else. */
function unquote(raw) {
  const s = raw.trim()
  if (s.length >= 2 && ((s[0] === '"' && s.endsWith('"')) || (s[0] === "'" && s.endsWith("'")))) {
    return s
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\')
  }
  return s
}

/**
 * The `connections:` block of one page's front-matter.
 *
 * Returns `{ items, wrapped }` — the entries, and a count of lines inside the
 * block that were neither an item opener nor one of the three known keys. That
 * second number is the tripwire: it is 0 across the whole corpus today, and a
 * build that sees it go positive knows the front-matter has grown a shape this
 * reader does not understand rather than quietly dropping it.
 */
export function readConnections(fmRaw) {
  const items = []
  let wrapped = 0
  if (!fmRaw || !fmRaw.includes('connections:')) return { items, wrapped }

  const lines = fmRaw.split('\n')
  const at = lines.findIndex((l) => /^connections:\s*$/.test(l))
  if (at < 0) return { items, wrapped } // `connections: []` or an inline form

  let cur = null
  for (let i = at + 1; i < lines.length; i++) {
    const line = lines[i]
    // The block ends at the next key in column zero. A blank line does not end
    // it — several pages separate their entries with one.
    if (line.trim() !== '' && !/^\s/.test(line)) break

    const opener = line.match(/^\s*-\s+(.*)$/)
    if (opener) {
      if (cur) items.push(cur)
      cur = { page: null, type: null, claim: null }
      const rest = opener[1]
      const kv = rest.match(/^(page|type|claim):\s*([\s\S]*)$/)
      if (kv) cur[kv[1]] = unquote(kv[2])
      else if (rest.trim()) wrapped++
      continue
    }

    if (!cur) {
      if (line.trim()) wrapped++
      continue
    }

    const kv = line.match(/^\s+(page|type|claim):\s*([\s\S]*)$/)
    if (kv) cur[kv[1]] = unquote(kv[2])
    else if (line.trim()) wrapped++
  }
  if (cur) items.push(cur)

  // An entry missing any of the three is not a connection; the corpus has none
  // today, and one appearing is a shape change the caller should hear about.
  const whole = items.filter((c) => c.page && c.type && c.claim)
  wrapped += items.length - whole.length
  return { items: whole, wrapped }
}

/** `wiki/people/annie-ulmer` and `people/annie-ulmer` are the same page. */
export const bareSlug = (ref) => String(ref).replace(/^wiki\//, '').replace(/\.md$/, '').trim()

/**
 * A scalar off the front-matter, by key, at column zero. Used for the handful
 * of fields the page JSON's `meta` stringifies into a shape that is not JSON
 * (`"[relationships, infidelity, nyc-era]"` is not parseable and never was).
 */
export function readScalar(fmRaw, key) {
  if (!fmRaw) return null
  const m = fmRaw.match(new RegExp(`^${key}:[ \\t]*(.+)$`, 'm'))
  return m ? unquote(m[1]) : null
}
