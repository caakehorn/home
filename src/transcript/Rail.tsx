import { Fragment, useMemo } from 'react'
import { monthLabel, monthShort, type Gap, type MonthMeta, type TranscriptIndex } from './core'

/**
 * The spine: every month the record covers, and — drawn as what they are — the
 * runs of months it does not.
 *
 * A missing month is a hole in the exports rather than a quiet month in the
 * thread, and the two look identical if you only draw the months that exist.
 * So the gaps get their own band, sized by how long they ran. Nothing here is
 * a judgement about the silence; it is a statement that the silence is the
 * archive's and not the record's.
 */
export function Rail({
  index,
  current,
  onPick,
}: {
  index: TranscriptIndex
  current: string
  onPick: (bin: string) => void
}) {
  // Months and gaps interleaved in one chronological run, so the rail reads
  // left to right as elapsed time rather than as a list of what survived.
  const track = useMemo(() => {
    const gapAfter = new Map<string, Gap>()
    for (const gap of index.gaps) {
      const before = index.months.filter((m) => m.bin < gap.from).at(-1)
      if (before) gapAfter.set(before.bin, gap)
    }

    const rows: { year: number; cells: ({ month: MonthMeta } | { gap: Gap })[] }[] = []
    for (const month of index.months) {
      const year = Number(month.bin.slice(0, 4))
      if (rows.at(-1)?.year !== year) rows.push({ year, cells: [] })
      rows.at(-1)!.cells.push({ month })
      const gap = gapAfter.get(month.bin)
      if (gap) rows.at(-1)!.cells.push({ gap })
    }
    return rows
  }, [index])

  const peak = Math.max(...index.months.map((m) => m.count))

  return (
    <nav className="tsc__rail" aria-label="The record, by month">
      {track.map((row) => (
        <Fragment key={row.year}>
          <span className="tsc__rail-year">{row.year}</span>
          <ul className="tsc__rail-run">
            {row.cells.map((cell, i) =>
              'gap' in cell ? (
                <li key={`gap-${i}`} className="tsc__rail-gap" style={{ ['--wide' as string]: cell.gap.months }}>
                  <span>
                    {cell.gap.months} MONTH{cell.gap.months === 1 ? '' : 'S'} NOT IN THE EXPORTS
                  </span>
                </li>
              ) : (
                <li key={cell.month.bin}>
                  <button
                    type="button"
                    className={`tsc__rail-month${cell.month.bin === current ? ' tsc__rail-month--on' : ''}`}
                    aria-current={cell.month.bin === current ? 'true' : undefined}
                    onClick={() => onPick(cell.month.bin)}
                    title={`${monthLabel(cell.month.bin)} — ${cell.month.count.toLocaleString()} messages`}
                  >
                    <span
                      className="tsc__rail-bar"
                      aria-hidden="true"
                      style={{ ['--h' as string]: `${Math.max(6, (cell.month.count / peak) * 100)}%` }}
                    />
                    <span className="tsc__rail-name">{monthShort(cell.month.bin)}</span>
                  </button>
                </li>
              ),
            )}
          </ul>
        </Fragment>
      ))}
    </nav>
  )
}
