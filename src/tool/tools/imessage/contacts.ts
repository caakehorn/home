/**
 * An address book, read in this browser and kept in it.
 *
 * ---- where it goes ---------------------------------------------------------
 *
 * Nowhere. This is a static site: there is no server behind it, no upload
 * endpoint, and nothing here ever leaves the tab. A contacts file is parsed in
 * the page, held in `localStorage` under one key, and used for two things —
 * finding a number without going to look for it, and stamping a real name onto
 * the rows of the export. `contacts clear` removes it, and so does clearing
 * site data.
 *
 * That is not a nice-to-have property of the implementation, it is the only
 * acceptable one. A contact book is the most sensitive file most people own and
 * it is full of other people's details, given for a different purpose. A room
 * that took an upload of it would be asking for a level of trust that a page
 * handing out shell commands has not earned and does not need.
 *
 * ---- two formats, both parsed by hand --------------------------------------
 *
 * Google Contacts CSV, because that is what most people already have exported
 * somewhere, and macOS `.vcf`, because that is what the Contacts app on the Mac
 * this tool is aimed at actually produces — File > Export > Export vCard.
 *
 * Both parsers are written here rather than pulled in. The site ships four
 * dependencies and this is worth none of them: a correct RFC 4180 reader is
 * forty lines, and the vCard subset that matters is another forty. What is not
 * worth skimping on is the CSV quoting rules — a field may contain commas,
 * newlines and doubled quotes, and a splitter that does `line.split(',')`
 * silently mangles every contact with a comma in their name and then, worse,
 * shifts every column after it.
 */

/** One person, flattened to what this tool can use. */
export type Contact = {
  name: string
  /** Phone numbers and email addresses, in the order the file gave them. */
  handles: string[]
}

export type ParseResult = {
  contacts: Contact[]
  /** What was in the file but could not be used, said plainly. */
  skipped: number
  format: 'google-csv' | 'vcard'
}

/* ==========================================================================
   CSV

   RFC 4180 proper, because the shortcuts are what break. A quoted field may
   contain a comma, a newline, and a doubled quote meaning one quote; anything
   that splits on commas first gets all three wrong and shifts every column
   after the offending one, which is the failure that produces phone numbers in
   the name column and is never noticed until an export is empty.
   ========================================================================== */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  // A BOM at the head of a Google export would otherwise become part of the
  // first header, which is how "Name" stops matching "﻿Name".
  const src = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim()))
}

/** Google puts several values in one cell, separated like this. */
const MULTI = /\s*:::\s*/

const firstHeader = (head: string[], names: string[]) => {
  for (const want of names) {
    const at = head.findIndex((h) => h.trim().toLowerCase() === want.toLowerCase())
    if (at >= 0) return at
  }
  return -1
}

const allHeaders = (head: string[], pattern: RegExp) =>
  head.map((h, i) => (pattern.test(h.trim()) ? i : -1)).filter((i) => i >= 0)

/**
 * Google Contacts CSV.
 *
 * Google has shipped several header sets over the years — `Name` in some
 * exports, `First Name`/`Last Name` in others, `Given Name`/`Family Name` in
 * older ones — so the columns are looked up by any of their known names rather
 * than by position. Falling back to an organisation name matters more than it
 * sounds: a business saved with no personal name is otherwise a contact with a
 * number and no label at all.
 */
export function fromGoogleCsv(text: string): ParseResult {
  const rows = parseCsv(text)
  if (!rows.length) return { contacts: [], skipped: 0, format: 'google-csv' }

  const head = rows[0]
  const nameAt = firstHeader(head, ['Name', 'Display Name', 'Formatted Name'])
  const firstAt = firstHeader(head, ['First Name', 'Given Name'])
  const middleAt = firstHeader(head, ['Middle Name', 'Additional Name'])
  const lastAt = firstHeader(head, ['Last Name', 'Family Name'])
  const orgAt = firstHeader(head, ['Organization Name', 'Organization 1 - Name'])
  const phoneAt = allHeaders(head, /^phone\s*\d*\s*-\s*value$/i)
  const emailAt = allHeaders(head, /^e-?mail\s*\d*\s*-\s*value$/i)

  const contacts: Contact[] = []
  let skipped = 0

  for (const row of rows.slice(1)) {
    const cell = (i: number) => (i >= 0 ? (row[i] ?? '').trim() : '')
    const name =
      cell(nameAt) ||
      [cell(firstAt), cell(middleAt), cell(lastAt)].filter(Boolean).join(' ') ||
      cell(orgAt)

    const handles = [...phoneAt, ...emailAt]
      .flatMap((i) => cell(i).split(MULTI))
      .map((h) => h.trim())
      .filter(Boolean)

    // A contact with no handle cannot be used to find anything, and one with no
    // name would appear in the picker as a blank row. Both are counted rather
    // than dropped in silence, so a file that mostly did not parse says so.
    if (!handles.length || !name) skipped += 1
    else contacts.push({ name, handles })
  }

  return { contacts, skipped, format: 'google-csv' }
}

/* ==========================================================================
   vCARD

   What the macOS Contacts app exports. Three things about the format bite:
   long lines are FOLDED across a newline plus one leading space, which has to
   be undone before anything else; a property name can carry an `item1.` prefix
   and any number of `;`-separated parameters before the colon; and the value
   itself escapes `,` `;` and newlines with a backslash.
   ========================================================================== */

/** Undo RFC 5545/6350 line folding: a leading space or tab continues the line. */
const unfold = (text: string) =>
  text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '')

const unescapeValue = (value: string) =>
  value.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim()

export function fromVcard(text: string): ParseResult {
  const contacts: Contact[] = []
  let skipped = 0

  for (const card of unfold(text).split(/BEGIN:VCARD/i).slice(1)) {
    let fn = ''
    let structured = ''
    let org = ''
    const handles: string[] = []

    for (const line of card.split('\n')) {
      const at = line.indexOf(':')
      if (at < 0) continue
      const left = line.slice(0, at)
      const value = unescapeValue(line.slice(at + 1))
      if (!value) continue
      // `item1.TEL;type=CELL` — drop the grouping prefix and the parameters.
      const prop = left.split(';')[0].replace(/^[^.]*\./, '').trim().toUpperCase()

      if (prop === 'FN') fn = value
      // N is Family;Given;Middle;Prefix;Suffix — reordered to read as a name.
      else if (prop === 'N' && !structured) {
        const [family, given, middle] = value.split(';')
        structured = [given, middle, family].map((p) => (p ?? '').trim()).filter(Boolean).join(' ')
      } else if (prop === 'ORG') org = value.split(';')[0].trim()
      else if (prop === 'TEL' || prop === 'EMAIL') handles.push(value)
    }

    const name = fn || structured || org
    if (!handles.length || !name) skipped += 1
    else contacts.push({ name, handles })
  }

  return { contacts, skipped, format: 'vcard' }
}

/** Pick a parser from the filename, falling back to what the content looks like. */
export function parseContacts(filename: string, text: string): ParseResult {
  if (/\.vcf$/i.test(filename) || /^\s*BEGIN:VCARD/i.test(text)) return fromVcard(text)
  return fromGoogleCsv(text)
}

/* ==========================================================================
   KEEPING THEM
   ========================================================================== */

const KEY = 'danfrank:tool:contacts:v1'

/**
 * Read and write follow the same shape as `src/wiki/store.ts`: every access is
 * wrapped, because localStorage throws outright in a private window and on a
 * quota, and a room that crashes on a browser setting is worse than one that
 * quietly has no address book.
 */
export function loadContacts(): Contact[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Contact[]) : []
  } catch {
    return []
  }
}

export function saveContacts(contacts: Contact[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(contacts))
    return true
  } catch {
    // Realistically the quota, on a very large address book. The caller says so.
    return false
  }
}

export function clearContacts() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to be done, and nothing that needs saying */
  }
}

/**
 * Find people by name or by handle.
 *
 * Digits are compared against digits so that typing `5550104477` finds a
 * contact stored as `+1 (555) 010-4477` — the same normalisation the generated
 * SQL does, for the same reason.
 */
export function findContacts(contacts: Contact[], query: string, limit = 8): Contact[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const digits = q.replace(/\D+/g, '')

  const scored = contacts
    .map((c) => {
      const name = c.name.toLowerCase()
      let score = 0
      if (name === q) score = 1000
      else if (name.startsWith(q)) score = 600
      else if (name.includes(q)) score = 400
      if (digits.length >= 4) {
        for (const h of c.handles) {
          if (h.replace(/\D+/g, '').includes(digits)) score = Math.max(score, 700)
        }
      }
      for (const h of c.handles) {
        if (h.toLowerCase().includes(q)) score = Math.max(score, 500)
      }
      return { c, score }
    })
    .filter((s) => s.score > 0)

  // Ties break on name so the list is stable between keystrokes rather than
  // reordering under the reader's finger.
  scored.sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name))
  return scored.slice(0, limit).map((s) => s.c)
}
