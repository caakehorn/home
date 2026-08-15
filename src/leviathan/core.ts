import { useEffect, useState } from 'react'

/**
 * LEVIATHAN — the core.
 *
 * The old site was thirty-seven instruments over two sections, each one a
 * hand-wired page that loaded its own payload and drew its own chrome. This is
 * the rack they get rebuilt into: a registry that says what an instrument is,
 * a loader that hands it a dataset, and a frame that gives every one of them
 * the same header, the same method note and the same source line.
 *
 * THE RULE comes across from the original unchanged, and it is the reason the
 * wing is worth building rather than just pretty: **no instrument makes a
 * judgement.** Every number is a count, a date or a length, taken over the
 * whole corpus with nothing excluded and nothing weighted. No sentiment
 * scoring, no keyword lists, no threshold chosen for what it would surface.
 * Anything editorial would make the output a portrait of an argument; left
 * alone, the counts make a portrait of the thing itself.
 */

export type InstrumentStatus =
  /** Built, wired to a dataset that ships with the site. */
  | 'LIVE'
  /** Declared, and waiting on a corpus this site does not carry. */
  | 'SEALED'

export type Instrument = {
  id: string
  /** Instruments are numbered in the old house style. */
  numeral: string
  title: string
  kana: string
  /** What it is computed over. */
  corpus: string
  blurb: string
  /** How the numbers were arrived at, in one sentence. Every instrument owes this. */
  method: string
  status: InstrumentStatus
  /** For SEALED entries: what would have to arrive for it to light up. */
  needs?: string
}

export const INSTRUMENTS: Instrument[] = [
  {
    id: 'mass',
    numeral: 'I',
    title: 'THE MASS',
    kana: '質量',
    corpus: '458 wiki pages · 442,440 words',
    blurb: 'Where the weight actually sits. Nine domains, by how much has been written in them.',
    method: 'Word counts per page, summed by domain. Nothing weighted, nothing excluded.',
    status: 'LIVE',
  },
  {
    id: 'chronology',
    numeral: 'II',
    title: 'THE CHRONOLOGY',
    kana: '年代',
    corpus: '4,987 dated mentions · 1900 → 2026',
    blurb:
      'Every date the wiki names, mined out of its own prose — not the timeline pages, the whole corpus. Where the record thickens, and where it goes quiet.',
    method:
      'Dates parsed from page bodies by the same matchers the brief visualiser uses, counted once per page per distinct date.',
    status: 'LIVE',
  },
  {
    id: 'pen',
    numeral: 'III',
    title: 'THE PEN',
    kana: '筆',
    corpus: '4,987 dated mentions · 1900 → 2026',
    blurb:
      'The chart recorder from the old console, with the lanes finally carrying something. Four counts against one axis, traced by a stylus that sits where the value is.',
    method:
      'Per year: mentions landing in it, distinct pages naming it, distinct domains among those pages, and pages whose earliest named date it is. Each lane scaled to its own maximum, which is printed beside it.',
    status: 'LIVE',
  },
  {
    id: 'ask',
    numeral: 'IV',
    title: 'THE ASK',
    kana: '請求',
    corpus: 'the message record',
    blurb: 'Every request, recounted from the raw corpus, in the order it was made.',
    method: 'Ledger rows counted from the message export; citations, not claims.',
    status: 'SEALED',
    needs: 'the message corpus, which is not vendored here',
  },
  {
    id: 'clock',
    numeral: 'V',
    title: 'THE CLOCK',
    kana: '時計',
    corpus: 'eleven years of messages',
    blurb: 'Every message placed by when it was sent. Angle is the hour, radius is the date.',
    method: 'Timestamps read from the string, never through Date(), so no timezone can move an hour.',
    status: 'SEALED',
    needs: 'the message corpus, which is not vendored here',
  },
]

export const instrumentById = (id: string) => INSTRUMENTS.find((i) => i.id === id)

// ---------------------------------------------------------------------------
// datasets

const asset = (file: string) => `${import.meta.env.BASE_URL}leviathan/${file}`.replace(/\/{2,}/g, '/')

const cache = new Map<string, Promise<unknown>>()

export function loadSet<T>(file: string): Promise<T> {
  if (!cache.has(file)) {
    cache.set(
      file,
      fetch(asset(file)).then((r) => {
        if (!r.ok) throw new Error(`dataset "${file}" unavailable (${r.status})`)
        return r.json()
      }),
    )
  }
  return cache.get(file) as Promise<T>
}

type Async<T> = { data: T | null; error: string | null; loading: boolean }

export function useSet<T>(file: string): Async<T> {
  const [state, setState] = useState<Async<T>>({ data: null, error: null, loading: true })
  useEffect(() => {
    let live = true
    setState({ data: null, error: null, loading: true })
    loadSet<T>(file)
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((e: Error) => live && setState({ data: null, error: e.message, loading: false }))
    return () => {
      live = false
    }
  }, [file])
  return state
}

// ---------------------------------------------------------------------------
// dataset shapes

export type MassDomain = {
  id: string
  pages: number
  words: number
  links: number
  charts: number
  briefs: number
  longest: { slug: string; title: string; words: number }
}

export type MassSet = {
  domains: MassDomain[]
  pages: { slug: string; title: string; domain: string; words: number }[]
}

export type DateRef = { slug: string; title: string; label: string }

/** A page in a year's panel: its first date there, and how many it named. */
export type YearRef = DateRef & { dates: number }

export type ChronologySet = {
  mentions: number
  months: { bin: string; year: number; month: number; count: number; pages: DateRef[] }[]
  years: { year: number; count: number; pages: number; sample: YearRef[] }[]
}
