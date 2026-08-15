/**
 * Turns a markdown table into something chartable.
 *
 * The wiki is full of tables like `| Year | Watched events | Character |` —
 * a label column plus one or more numeric columns. Those are the numbers
 * worth drawing; everything else stays a table.
 */

export type TableData = { headers: string[]; rows: string[][] }

export type Series = { name: string; values: (number | null)[] }

export type ChartSpec = {
  /** Time-ordered labels read as change-over-time; anything else is magnitude. */
  form: 'line' | 'bar'
  labelHeader: string
  labels: string[]
  series: Series[]
  /** Trailing text stripped off the numbers, e.g. "(all-time peak)". */
  notes: (string | null)[]
  unit: string
}

/** "3,538 (all-time peak)" -> 3538 ; "42%" -> 42 ; "—" -> null */
export function parseNumber(cell: string): number | null {
  if (!cell) return null
  const cleaned = cell.replace(/\(.*?\)/g, ' ').replace(/[,$]/g, '').trim()
  const match = cleaned.match(/^[-+]?\d+(\.\d+)?/)
  if (!match) return null
  const n = Number(match[0])
  return Number.isFinite(n) ? n : null
}

const noteOf = (cell: string) => cell.match(/\((.*?)\)/)?.[1] ?? null

const unitOf = (cells: string[]) => {
  if (cells.some((c) => c.includes('%'))) return '%'
  if (cells.some((c) => c.trim().startsWith('$'))) return '$'
  return ''
}

/** Years, dates and month names make a table a time series. */
function looksTemporal(labels: string[]) {
  const hits = labels.filter((l) =>
    /^(19|20)\d{2}([-/].+)?$/.test(l.trim()) ||
    /^\d{4}-\d{2}(-\d{2})?$/.test(l.trim()) ||
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(l.trim()),
  ).length
  return labels.length >= 3 && hits >= labels.length * 0.8
}

const strip = (s: string) => s.replace(/\*\*|__|`|\[\[|\]\]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim()

/**
 * Returns a chart spec when the table has a label column and at least one
 * mostly-numeric column, otherwise null.
 */
export function analyzeTable(table: TableData): ChartSpec | null {
  const { headers, rows } = table
  if (headers.length < 2 || rows.length < 2) return null

  const labels = rows.map((r) => strip(r[0] ?? ''))
  if (labels.some((l) => !l)) return null

  const series: Series[] = []
  let notes: (string | null)[] = rows.map(() => null)
  let unit = ''

  for (let c = 1; c < headers.length; c++) {
    const cells = rows.map((r) => (r[c] ?? '').trim())
    const values = cells.map(parseNumber)
    const hits = values.filter((v) => v !== null).length
    // Mostly-numeric, and not a column of years masquerading as a measure.
    if (hits < Math.max(2, values.length * 0.6)) continue
    series.push({ name: strip(headers[c]), values })
    if (!unit) unit = unitOf(cells)
    const columnNotes = cells.map(noteOf)
    if (columnNotes.some(Boolean) && notes.every((n) => !n)) notes = columnNotes
  }

  if (!series.length) return null
  // Four is the direct-label ceiling; beyond that a table reads better.
  if (series.length > 4) return null

  return {
    form: looksTemporal(labels) ? 'line' : 'bar',
    labelHeader: strip(headers[0]),
    labels,
    series,
    notes,
    unit,
  }
}

export const formatValue = (n: number, unit: string) => {
  const s = Math.abs(n) >= 1000 ? n.toLocaleString('en-US') : String(n)
  return unit === '%' ? `${s}%` : unit === '$' ? `$${s}` : s
}
