import { useMemo, useState } from 'react'
import { PenChart } from '../PenChart'
import type { PenRow } from '../PenChart'
import { useSet, type Instrument } from '../core'
import '../ask.css'

type AskLane = { key: string; label: string; kinds: string[]; precision: number | null; unit: string }

type AskRecord = {
  d: string
  t: string
  k: string
  lane: string
  means: string
  precision: number
  x: string
}

type AskSet = {
  meta: {
    herMessages: number
    from: string
    to: string
    precision: Record<string, number>
    dollarsStated: number
    dollarMentions: number
    total: number
  }
  from: string
  to: string
  months: number
  total: number
  lanes: AskLane[]
  rows: PenRow[]
  records: AskRecord[]
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

function stamp(row: PenRow) {
  const [year, month] = String(row.bin).split('-')
  return `${MONTHS[Number(month) - 1] ?? month} ${year}`
}

/**
 * PROCUREMENT VI · THE ASK
 *
 * The most carefully built instrument in the old repo, brought across whole:
 * 357 records drawn from 18,946 messages, merged out of every thread export,
 * timezone-corrected, deduplicated, classified by speech-act frame plus named
 * object, and then read by hand with the false positives struck.
 *
 * **Every lane prints the precision of that hand audit** — 100% on some, 57%
 * on the worst. That is the original's own arrangement and its own reason for
 * it: a number nobody can check is not evidence. A lane is shown at the worst
 * precision among the categories it folds, because a lane is only as good as
 * its weakest member.
 *
 * The lane groupings are the original's, reproduced rather than re-argued.
 */
export function Ask({ instrument }: { instrument: Instrument }) {
  const { data } = useSet<AskSet>('ask.json')
  const [lane, setLane] = useState<string | null>(null)

  const records = data?.records ?? []
  const lanes = data?.lanes ?? []

  const shown = useMemo(
    () => (lane ? records.filter((r) => r.lane === lane) : records),
    [records, lane],
  )

  /** The precision each lane carries, keyed for the lane strip under the chart. */
  const audited = lanes.filter((l) => l.precision !== null)

  return (
    <PenChart
      instrument={instrument}
      file="ask.json"
      speed={4}
      gutter={188}
      axis={{
        label: 'MONTH',
        stamp,
        // Seventeen months is few enough to tick every quarter and still read.
        ticks: (rows: PenRow[]) =>
          rows
            .map((row, i) => ({ i, bin: String(row.bin) }))
            .filter((tick) => tick.i % 3 === 0)
            .map((tick) => ({ i: tick.i, text: stamp({ bin: tick.bin }) })),
      }}
      footer={() => (
        <p className="pen__note">
          Each lane is scaled to its own maximum and prints the worst hand-measured precision among
          the categories it folds. RUNNING TOTAL is the same records accumulated, so it only ever
          climbs — it is a restatement of the other five, not a sixth finding. The lane groupings
          are the original's, reproduced rather than re-argued.
        </p>
      )}
      after={() => (
        <div className="ask">
          <section className="ask__audit">
            <h2 className="ask__h">THE AUDIT</h2>
            <p className="ask__lede">
              Every hit was read by hand and the false positives struck. What survived is below, per
              category, as measured against a full manual read — the same table the original
              published, for the same reason: a number nobody can check is not evidence.
            </p>
            <table className="ask__table">
              <thead>
                <tr>
                  <th scope="col">LANE</th>
                  <th scope="col">FOLDS</th>
                  <th scope="col">PRECISION</th>
                </tr>
              </thead>
              <tbody>
                {audited.map((l) => (
                  <tr key={l.key}>
                    <th scope="row">{l.label}</th>
                    <td>{l.kinds.join(', ')}</td>
                    <td
                      className={
                        (l.precision ?? 100) < 80 ? 'ask__pc ask__pc--weak' : 'ask__pc'
                      }
                    >
                      {(l.precision ?? 100) < 80 && (
                        <span aria-hidden="true" className="ask__warn">
                          ⚠
                        </span>
                      )}
                      {l.precision}%
                      {(l.precision ?? 100) < 80 && <span className="ask__sr"> — read with care</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="ask__feed">
            <div className="ask__filters">
              <h2 className="ask__h">THE RECORDS</h2>
              <div className="ask__chips">
                <button
                  type="button"
                  className={lane === null ? 'ask__chip ask__chip--on' : 'ask__chip'}
                  onClick={() => setLane(null)}
                >
                  ALL {data?.total ?? 0}
                </button>
                {audited.map((l) => (
                  <button
                    key={l.key}
                    type="button"
                    className={lane === l.key ? 'ask__chip ask__chip--on' : 'ask__chip'}
                    onClick={() => setLane(lane === l.key ? null : l.key)}
                  >
                    {l.label} {records.filter((r) => r.lane === l.key).length}
                  </button>
                ))}
              </div>
            </div>

            <ol className="ask__list">
              {shown.map((r, i) => (
                <li key={`${r.d}-${r.t}-${i}`} className="ask__row">
                  <div className="ask__when">
                    <time dateTime={`${r.d}T${r.t}`}>
                      {r.d} {r.t}
                    </time>
                    <span className="ask__kind">{r.means}</span>
                    <span className={r.precision < 80 ? 'ask__pc ask__pc--weak' : 'ask__pc'}>
                      {r.precision < 80 && (
                        <span aria-hidden="true" className="ask__warn">
                          ⚠
                        </span>
                      )}
                      {r.precision}% precise
                    </span>
                  </div>
                  <blockquote className="ask__quote">{r.x}</blockquote>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    />
  )
}
