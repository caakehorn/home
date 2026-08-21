import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Frame } from '../Frame'
import { useSet, type ClockSet, type Instrument } from '../core'
import '../silence.css'

/**
 * ◈ CORPUS XIV · THE SILENCE
 *
 * The negative space of the record. Not the messages — the distances between
 * them: every gap, how long it ran, and which line ended it.
 *
 * ---- the distinction the whole instrument turns on -------------------------
 *
 * There are two kinds of nothing in this record and they are not the same
 * thing. One is a **silence**: two people who could have written and did not.
 * The other is a **hole**: an export that does not cover those months, so
 * nobody can say what happened in them. Ranked together by length the holes
 * win every position at the top of the list, and an instrument that presented
 * that as its finding would be reporting the shape of a zip file as the shape
 * of a relationship.
 *
 * So they are separated, and both are shown. A gap whose span touches one of
 * the 38 not-exported months is listed as **NOT EXPORTED** and is kept out of
 * the silences. That is a fact about the archive, stated; it is not a
 * judgement, and no gap is called anything else.
 *
 * ---- what a gap is --------------------------------------------------------
 *
 * The elapsed minutes between two consecutive messages. Nothing about a gap is
 * inferred beyond its length and its two ends, and the message that ended one
 * is **cited, never quoted** — the row number links into THE TRANSCRIPT, which
 * is where the words are. The index of a mark plus one is that line number, an
 * identity `scripts/build-clock.mjs` refuses to build without.
 */
export function Silence({ instrument }: { instrument: Instrument }) {
  const { data, error, loading } = useSet<ClockSet>('clock.json')
  const [top, setTop] = useState(20)

  const read = useMemo(() => {
    if (!data) return null

    /** Absolute minute of a packed mark, and the two parts it is made of. */
    const at = (value: number) => {
      const day = (value / 2880) | 0
      return { day, minute: (value - day * 2880) >> 1 }
    }

    const values = new Int32Array(data.marks.length)
    let running = 0
    for (let i = 0; i < data.marks.length; i++) {
      running += data.marks[i]
      values[i] = running
    }

    const holes = data.gaps
    const inHole = (fromDay: number, toDay: number) =>
      holes.find((hole) => fromDay <= hole.toDay && toDay >= hole.fromDay) ?? null

    type Gap = {
      minutes: number
      fromDay: number
      fromMinute: number
      toDay: number
      toMinute: number
      /** 1-based transcript line of the message that ended it. */
      line: number
      hole: (typeof holes)[number] | null
    }

    const silences: Gap[] = []
    const notExported: Gap[] = []
    // Disclosed buckets, and they are the only thresholds anywhere here: they
    // shape a histogram, they do not decide what gets listed.
    const buckets = [60, 360, 1440, 4320, 10080, 43200]
    const histogram = new Array(buckets.length + 1).fill(0)
    let longest: Gap | null = null

    for (let i = 1; i < values.length; i++) {
      const a = at(values[i - 1])
      const b = at(values[i])
      const minutes = (b.day - a.day) * 1440 + (b.minute - a.minute)
      if (minutes <= 0) continue

      const gap: Gap = {
        minutes,
        fromDay: a.day,
        fromMinute: a.minute,
        toDay: b.day,
        toMinute: b.minute,
        line: i + 1,
        hole: inHole(a.day, b.day),
      }
      if (gap.hole) {
        notExported.push(gap)
        // Deliberately not counted in the histogram either: a hole is not a
        // gap of that length between two people, and a distribution that
        // includes one has a tail made of missing files.
        continue
      }
      let bucket = 0
      while (bucket < buckets.length && minutes >= buckets[bucket]) bucket++
      histogram[bucket]++
      if (!longest || minutes > longest.minutes) longest = gap
      silences.push(gap)
    }

    silences.sort((x, y) => y.minutes - x.minutes)
    notExported.sort((x, y) => y.minutes - x.minutes)

    const last = at(values[values.length - 1])

    return { silences, notExported, histogram, buckets, longest, last, total: values.length }
  }, [data])

  if (loading)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">measuring the distances…</p>
      </Frame>
    )

  if (error || !data || !read)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">
          The dataset is missing ({error}). Run <code>npm run clock</code> and rebuild.
        </p>
      </Frame>
    )

  const shown = read.silences.slice(0, top)
  const peak = shown[0]?.minutes ?? 1
  // Computed at page load, not part of the record — and labelled as such.
  const sinceLast = Math.max(
    0,
    Math.floor((Date.now() - dayDate(data, read.last.day).getTime()) / 86_400_000),
  )

  return (
    <Frame
      instrument={instrument}
      controls={
        <div className="sil__depths" role="group" aria-label="How many">
          {[20, 50, 100].map((n) => (
            <button
              key={n}
              type="button"
              className={`sil__depth${top === n ? ' sil__depth--on' : ''}`}
              aria-pressed={top === n}
              onClick={() => setTop(n)}
            >
              TOP {n}
            </button>
          ))}
        </div>
      }
      footer={
        <p className="inst__method">
          <b>CITED, NOT QUOTED</b> The message that ended a gap is given as its line number in THE
          TRANSCRIPT and nothing else. The words are one click away in the room whose whole job is
          to hold them; reprinting them here would make this instrument an argument about what
          broke a silence rather than a measurement of how long it ran.
        </p>
      }
    >
      <div className="sil">
        <div className="sil__main">
          <h3 className="sil__sub">
            THE LONGEST SILENCES · {read.silences.length.toLocaleString()} GAPS MEASURED
          </h3>
          <ol className="sil__list">
            {shown.map((gap, i) => (
              <li key={gap.line} className="sil__row">
                <span className="sil__rank">{String(i + 1).padStart(2, '0')}</span>
                <span className="sil__bar">
                  <span
                    className="sil__fill"
                    style={{ inlineSize: `${(gap.minutes / peak) * 100}%` }}
                  />
                </span>
                <span className="sil__length">{span(gap.minutes)}</span>
                <span className="sil__ends">
                  {stamp(data, gap.fromDay, gap.fromMinute)} → {stamp(data, gap.toDay, gap.toMinute)}
                </span>
                <Link className="sil__cite" to={`/transcript#L${gap.line}`}>
                  BROKEN AT L{gap.line.toLocaleString()}
                </Link>
              </li>
            ))}
          </ol>
        </div>

        <div className="sil__readouts">
          <p className="sil__note">
            A gap is the elapsed time between two consecutive messages. Nothing about one is
            inferred beyond its length and its two ends.
          </p>

          <h3 className="sil__sub">HOW LONG A SILENCE RUNS</h3>
          <ol className="sil__hist">
            {read.histogram.map((count, i) => (
              <li key={i}>
                <span className="sil__hist-label">{bucketLabel(read.buckets, i)}</span>
                <span className="sil__bar sil__bar--thin">
                  <span
                    className="sil__fill sil__fill--hist"
                    style={{ inlineSize: `${(count / Math.max(...read.histogram)) * 100}%` }}
                  />
                </span>
                <span className="sil__hist-n">{count.toLocaleString()}</span>
              </li>
            ))}
          </ol>

          <h3 className="sil__sub">THE HOLES, WHICH ARE NOT SILENCES</h3>
          <p className="sil__note">
            {read.notExported.length === 0
              ? 'None: every gap in this record falls inside a month the exports cover.'
              : `${read.notExported.length} gap${read.notExported.length === 1 ? '' : 's'} span a month the exports do not cover. They are longer than every silence below them and they are not silences — nobody can say what happened in them. They are listed here rather than ranked above.`}
          </p>
          <ol className="sil__holes">
            {read.notExported.map((gap) => (
              <li key={gap.line}>
                <span className="sil__hole-span">{span(gap.minutes)}</span>
                <span className="sil__hole-ends">
                  {stamp(data, gap.fromDay, gap.fromMinute)} →{' '}
                  {stamp(data, gap.toDay, gap.toMinute)}
                </span>
                <span className="sil__hole-tag">
                  {gap.hole?.months} MONTH{gap.hole?.months === 1 ? '' : 'S'} NOT EXPORTED
                </span>
              </li>
            ))}
          </ol>

          <dl className="sil__facts">
            <dt>LONGEST SILENCE</dt>
            <dd>
              {read.longest ? span(read.longest.minutes) : '—'}
              {read.longest && (
                <>
                  {' '}
                  · ended {stamp(data, read.longest.toDay, read.longest.toMinute)}
                </>
              )}
            </dd>
            <dt>GAPS OVER A DAY</dt>
            <dd>
              {read.silences.filter((g) => g.minutes >= 1440).length.toLocaleString()} of{' '}
              {read.silences.length.toLocaleString()}
            </dd>
            <dt>SINCE THE LAST MESSAGE</dt>
            <dd>
              {sinceLast.toLocaleString()} days — counted from {data.to} to the day this page
              loaded, so it is the one number here that is not in the record
            </dd>
          </dl>
        </div>
      </div>
    </Frame>
  )
}

// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000

const dayDate = (data: ClockSet, day: number) =>
  new Date(
    Date.UTC(+data.from.slice(0, 4), +data.from.slice(5, 7) - 1, +data.from.slice(8, 10)) +
      day * DAY_MS,
  )

const stamp = (data: ClockSet, day: number, minute: number) =>
  `${dayDate(data, day).toISOString().slice(0, 10)} ${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`

/**
 * Minutes as the largest unit that does not round the number into a lie, and
 * without a trailing `.0` on the round ones. A "month" here is thirty days,
 * which is a unit of length rather than a calendar month — the buckets it
 * labels are spans, not dates.
 */
function span(minutes: number) {
  const say = (n: number, unit: string) =>
    `${Number.isInteger(n) ? n : n.toFixed(1)} ${unit}${n === 1 ? '' : 's'}`
  if (minutes < 60) return `${minutes} min`
  if (minutes < 1440) return say(round(minutes / 60), 'hour')
  if (minutes < 43200) return say(round(minutes / 1440), 'day')
  return say(round(minutes / 43200), 'month')
}

/** One decimal, and an exact integer stays one. */
const round = (n: number) => (Number.isInteger(n) ? n : Math.round(n * 10) / 10)

function bucketLabel(buckets: number[], i: number) {
  if (i === 0) return `under ${span(buckets[0])}`
  if (i === buckets.length) return `over ${span(buckets[buckets.length - 1])}`
  return `${span(buckets[i - 1])} – ${span(buckets[i])}`
}
