import { useEffect, useState } from 'react'

/**
 * THE TRANSCRIPT — the core.
 *
 * The complete message record between Dan and Annie, carried over from the old
 * repo (`caakehorn/leviathan`, `data/transcript.json`) and split at month
 * boundaries by `scripts/sync-transcript.mjs`. The index is the spine — every
 * month, its count, and the line number it starts at — and a month's messages
 * only arrive when somebody opens that month.
 *
 * THE RULE the instrument rack runs on applies here too, and harder: nothing
 * on this page is a reading of the record. There is no summary, no sentiment,
 * no selection, no "highlights". Every line is shown in the order it was sent,
 * with the words that were sent, and the only things this code adds are a line
 * number and a filter the reader asked for.
 */

/** `[timestamp, dir, text, flags]` — dir 1 = sent, 0 = received. */
export type Row = [string, 0 | 1, string, number]

/** flags bit 0 — the message carried a photo or an attachment. */
export const ATTACHED = 1
/** flags bit 1 — a tapback: a heart or a thumb on someone else's message. */
export const REACTION = 2

export type MonthMeta = {
  /** `YYYY-MM` */
  bin: string
  /** 1-based line number of this month's first message, global to the record. */
  from: number
  count: number
  sent: number
  received: number
  chars: number
}

export type Gap = { from: string; to: string; months: number }

export type TranscriptIndex = {
  generatedAt: string
  source: string
  builtAt: string | null
  handles: string[]
  count: number
  first: string
  last: string
  counts: {
    sent: number
    received: number
    attachments: number
    reactions: number
    characters: number
  }
  span: { months: number; covered: number }
  years: { year: number; count: number; months: number }[]
  months: MonthMeta[]
  gaps: Gap[]
}

export type MonthFile = { bin: string; from: number; count: number; m: Row[] }

/**
 * The two sides of the record, and the only place their names are written.
 *
 * `dir` comes off the export unchanged: the phone the messages were pulled
 * from is Dan's, so "sent" is his and "received" is hers. That is a fact about
 * whose device it was, not a judgement about anything.
 */
export const PARTIES = {
  sent: { key: 'dan', label: 'DAN', tone: 1 as const },
  received: { key: 'annie', label: 'ANNIE', tone: 2 as const },
}

export const partyOf = (dir: number) => (dir ? PARTIES.sent : PARTIES.received)

/** 0 both · 1 Dan only · 2 Annie only. */
export type DirFilter = 0 | 1 | 2

export const passesFilter = (dir: number, filter: DirFilter) =>
  filter === 0 || (filter === 1 ? dir === 1 : dir === 0)

// ---------------------------------------------------------------------------
// loading

const asset = (file: string) =>
  `${import.meta.env.BASE_URL}transcript/${file}`.replace(/\/{2,}/g, '/')

const cache = new Map<string, Promise<unknown>>()

function load<T>(file: string): Promise<T> {
  if (!cache.has(file)) {
    cache.set(
      file,
      fetch(asset(file)).then((r) => {
        if (!r.ok) throw new Error(`${file} unavailable (${r.status})`)
        return r.json()
      }),
    )
  }
  return cache.get(file) as Promise<T>
}

export const loadIndex = () => load<TranscriptIndex>('index.json')
export const loadMonth = (bin: string) => load<MonthFile>(`months/${bin}.json`)

type Async<T> = { data: T | null; error: string | null; loading: boolean }

const PENDING = { data: null, error: null, loading: true } as const

/** The spine. One fetch, cached, shared by every view in the wing. */
export function useIndex(): Async<TranscriptIndex> {
  const [state, setState] = useState<Async<TranscriptIndex>>(PENDING)
  useEffect(() => {
    let live = true
    loadIndex()
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((e: Error) => live && setState({ data: null, error: e.message, loading: false }))
    return () => {
      live = false
    }
  }, [])
  return state
}

/** One month's messages, fetched the first time that month is opened. */
export function useMonth(bin: string | null): Async<MonthFile> {
  const [state, setState] = useState<Async<MonthFile>>(PENDING)
  useEffect(() => {
    if (!bin) {
      setState({ data: null, error: null, loading: false })
      return
    }
    let live = true
    setState(PENDING)
    loadMonth(bin)
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((e: Error) => live && setState({ data: null, error: e.message, loading: false }))
    return () => {
      live = false
    }
  }, [bin])
  return state
}

/**
 * Every month, for the searches that have to cross the whole record.
 *
 * Searching one month at a time would be a search of one month, and the point
 * of a complete record is that a question can be asked of all of it. So this
 * pulls the lot — about 9 MB, a few seconds on a real connection — and says so
 * on screen while it happens rather than stalling silently. Months already in
 * the cache cost nothing, so opening a few and then searching is cheaper than
 * searching cold.
 */
export async function loadWholeRecord(
  index: TranscriptIndex,
  onProgress: (done: number, total: number) => void,
): Promise<Row[]> {
  const total = index.months.length
  let done = 0
  const files = await Promise.all(
    index.months.map((month) =>
      loadMonth(month.bin).then((file) => {
        onProgress(++done, total)
        return file
      }),
    ),
  )
  // Concatenated in bin order, so the result is the record itself: line N of
  // this array is line N+1 of the transcript, the same as every month file says.
  return files.flatMap((file) => file.m)
}

// ---------------------------------------------------------------------------
// reading helpers

/** `2015-11` → `NOVEMBER 2015`. */
const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
]

export function monthLabel(bin: string) {
  const [year, month] = bin.split('-')
  return `${MONTH_NAMES[Number(month) - 1]} ${year}`
}

export const monthShort = (bin: string) => MONTH_NAMES[Number(bin.slice(5)) - 1].slice(0, 3)

/** The month a global line number falls in, or null if it is off the end. */
export function monthOfLine(index: TranscriptIndex, line: number): MonthMeta | null {
  if (line < 1 || line > index.count) return null
  let lo = 0
  let hi = index.months.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (index.months[mid].from <= line) lo = mid
    else hi = mid - 1
  }
  return index.months[lo]
}

/**
 * A search term split out of the input, plus the `#1234` jump form.
 *
 * The old reader took both in one box and it was right to: "find me this" and
 * "take me to line this" are the same gesture from the reader's side.
 */
export function parseQuery(raw: string): { term: string; line: number | null } {
  const value = raw.trim()
  const jump = /^#?(\d+)$/.exec(value)
  if (jump) return { term: '', line: Number(jump[1]) }
  return { term: value.toLowerCase(), line: null }
}

/**
 * Splits a message around every occurrence of the term, so the match can be
 * marked without building HTML out of somebody's message text.
 */
export function splitOnTerm(text: string, term: string): { text: string; hit: boolean }[] {
  if (!term) return [{ text, hit: false }]
  const low = text.toLowerCase()
  const parts: { text: string; hit: boolean }[] = []
  let at = 0
  for (let k = low.indexOf(term, at); k !== -1; k = low.indexOf(term, at)) {
    if (k > at) parts.push({ text: text.slice(at, k), hit: false })
    parts.push({ text: text.slice(k, k + term.length), hit: true })
    at = k + term.length
  }
  if (at < text.length) parts.push({ text: text.slice(at), hit: false })
  return parts
}
