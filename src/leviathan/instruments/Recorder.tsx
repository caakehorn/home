import { PenChart } from '../PenChart'
import type { PenRow } from '../PenChart'
import type { Instrument } from '../core'

/** "2019-04" → "APR 2019", so the readout reads as a month rather than a key. */
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

function stamp(row: PenRow) {
  const [year, month] = String(row.bin).split('-')
  return `${MONTHS[Number(month) - 1] ?? month} ${year}`
}

/**
 * V · THE RECORDER
 *
 * THE POLYGRAPH's drum, wound over the corpus the polygraph actually ran on.
 *
 * The old console's MODULE 08 was the best-looking instrument on that site and
 * it is BARRED here, permanently: its four pens were LOVE, PROFANITY, APOLOGY
 * and SHOUT, four keyword lists asked to stand in for a mood. What comes
 * across is the chart recorder, not the pens — the same scaffold THE PEN runs
 * over the wiki, pointed at 134,348 messages and given four channels that are
 * only ever counted.
 *
 * The 38 months the exports do not cover are hatched at their real width and
 * the stylus lifts clean off the paper across them, because a month with no
 * export is not a month with no messages and a line drawn through it would
 * claim it was.
 */
export function Recorder({ instrument }: { instrument: Instrument }) {
  return (
    <PenChart
      instrument={instrument}
      file="recorder.json"
      speed={26}
      axis={{
        label: 'MONTH',
        stamp,
        ticks: (rows: PenRow[]) =>
          rows
            .map((row, i) => ({ i, bin: String(row.bin) }))
            .filter((tick) => tick.bin.endsWith('-01'))
            .map((tick) => ({ i: tick.i, text: tick.bin.slice(0, 4) })),
        blank: (row: PenRow) => Number(row.covered) === 0,
      }}
      footer={(maxima) => (
        <p className="pen__note">
          Each lane is scaled to its own maximum, printed beside its name — WORDS reaches{' '}
          {maxima.words?.toLocaleString() ?? '—'} in a month and DAYS cannot exceed 31, so a shared
          axis would draw three flat lines under one — SENT and RECEIVED included, since each is
          read against its own peak rather than the other's. Where the two traces part, one side of
          the thread is doing the writing. DAYS against either of them is the difference between a
          month that was busy and a month that was busy on four days. The hatched stretches are the
          38 months no export covers — the stylus lifts across them rather than tracing a zero,
          because a hole in an archive is not a quiet month.
        </p>
      )}
    />
  )
}
