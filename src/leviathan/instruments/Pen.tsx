import { PenChart } from '../PenChart'
import type { PenRow } from '../PenChart'
import type { Instrument } from '../core'

/**
 * III · THE PEN
 *
 * The chart recorder over the wiki's dated mentions: four counts per year,
 * 1900 to 2027, against one axis. The drum itself lives in `../PenChart`,
 * because THE RECORDER winds the same one over the message record; what is
 * here is what this instrument reads and what it owes the reader afterwards.
 */
export function Pen({ instrument }: { instrument: Instrument }) {
  return (
    <PenChart
      instrument={instrument}
      file="pen.json"
      axis={{
        label: 'YEAR',
        stamp: (row: PenRow) => String(row.year),
        ticks: (rows: PenRow[]) =>
          rows
            .map((row, i) => ({ i, text: String(row.year) }))
            .filter((tick) => Number(tick.text) % 20 === 0),
      }}
      footer={(maxima) => (
        <p className="pen__note">
          Each lane is scaled to its own maximum, printed beside its name — MENTIONS reaches{' '}
          {maxima.mentions?.toLocaleString() ?? '—'} and DOMAINS reaches {maxima.domains ?? '—'}, so a
          shared axis would flatten three lanes to make a point about one. Where MENTIONS climbs and
          PAGES does not, one page is doing the talking.
        </p>
      )}
    />
  )
}
