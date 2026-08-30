/**
 * The arithmetic — unit reports, and the statistics across units.
 *
 * Everything in this file is a count, a date, a length, or a mean/median of
 * those. That is not a style preference here; it is the standing rule the rest
 * of this repository is built under (`src/leviathan/core.ts`, and §2 of
 * CLAUDE.md): no instrument makes a judgement. There is no score, no severity,
 * no "heavy use" flag, and no threshold picked for what it would surface.
 *
 * The one span this file chooses for you is the width of the densest-window
 * search, and it is a parameter with the default printed on the report rather
 * than a constant buried here — because a six-hour window and a twelve-hour
 * window find different nights, and a reader who cannot see which was used is
 * reading an opinion.
 *
 * ---- what the reports refuse to say ----------------------------------------
 *
 * Every mean carries the denominator it was taken over. `meanDose` is the mean
 * of the *quantified* events and is null when there are none — never the
 * initial quantity divided by the event count, which is the number this whole
 * design exists to not produce. Where the log cannot answer, the field is null
 * and the screen prints the reason.
 *
 * ---- the burn quartiles ----------------------------------------------------
 *
 * "Did it go faster at the end" is the most interesting question a finite unit
 * can be asked, and it is answerable without judgement: walk the quantified
 * events in order, note the clock when the cumulative total crossed each
 * quarter of what was eventually accounted for, and report the elapsed time and
 * event count of each stretch. Quartiles are taken over the quantified total
 * rather than the initial quantity on purpose — over the initial quantity they
 * would be undefined for every unit whose log does not reach 100%, which is
 * most of them, and forcing them to be defined would mean inventing the
 * missing material.
 */

import { instant, localDay, localHour } from './events.ts'
import { live, type IntakeRecord, type Ledger, type UnitRecord } from './project.ts'
import { convert } from './uom.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** Default width of the densest-window search. Printed wherever it is used. */
export const WINDOW_HOURS = 6

// ---------------------------------------------------------------------------
// small statistics

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : null)

export function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Linear-interpolated quantile, the definition every spreadsheet uses. */
export function quantile(xs: number[], p: number): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const at = (s.length - 1) * p
  const lo = Math.floor(at)
  const hi = Math.ceil(at)
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (at - lo)
}

/** Sample standard deviation. Null under two points, where it means nothing. */
export function stdev(xs: number[]): number | null {
  if (xs.length < 2) return null
  const m = sum(xs) / xs.length
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1))
}

// ---------------------------------------------------------------------------
// the pieces a unit report is made of

/** Every quantified intake against a unit, in that unit's own uom, in time order. */
export function quantifiedDoses(unit: UnitRecord): { at: string; amount: number }[] {
  const out: { at: string; amount: number }[] = []
  for (const intake of live(unit)) {
    if (intake.measurement === 'unquantified' || intake.quantity === null || !intake.uom) continue
    const amount = convert(intake.quantity, intake.uom, unit.uom)
    if (amount === null) continue
    out.push({ at: intake.occurredAt, amount })
  }
  return out.sort((a, b) => instant(a.at) - instant(b.at))
}

/** Milliseconds between consecutive events. One fewer than there are events. */
export function intervals(times: string[]): number[] {
  const ms = times.map(instant).sort((a, b) => a - b)
  const out: number[] = []
  for (let i = 1; i < ms.length; i++) out.push(ms[i] - ms[i - 1])
  return out
}

export type Window = { start: string; end: string; events: number }

/**
 * The `spanHours` window holding the most events.
 *
 * A sliding window over the sorted instants — no bucketing, so a burst that
 * straddles midnight is found rather than split between two days. Ties go to
 * the earliest window, which is arbitrary but stated.
 */
export function densestWindow(times: string[], spanHours = WINDOW_HOURS): Window | null {
  if (!times.length) return null
  const ms = times.map(instant).sort((a, b) => a - b)
  const span = spanHours * HOUR
  let best = { from: 0, count: 0 }
  let left = 0
  for (let right = 0; right < ms.length; right++) {
    while (ms[right] - ms[left] > span) left++
    if (right - left + 1 > best.count) best = { from: left, count: right - left + 1 }
  }
  const startMs = ms[best.from]
  const startIso = times.find((t) => instant(t) === startMs) ?? new Date(startMs).toISOString()
  return {
    start: startIso,
    end: new Date(startMs + span).toISOString(),
    events: best.count,
  }
}

export type Quarter = {
  label: string
  events: number
  quantity: number
  /** Milliseconds from the previous boundary to this one. */
  elapsed: number
}

/**
 * How long each quarter of the accounted-for material took.
 *
 * Null when there are fewer than four quantified events — with three points
 * there are no quarters, only a shape three numbers were forced into.
 */
export function burnQuarters(unit: UnitRecord): Quarter[] | null {
  const doses = quantifiedDoses(unit)
  if (doses.length < 4) return null
  const total = sum(doses.map((d) => d.amount))
  if (total <= 0) return null

  const bounds = [0.25, 0.5, 0.75, 1]
  const labels = ['first 25%', 'second 25%', 'third 25%', 'final 25%']
  const out: Quarter[] = []

  let cumulative = 0
  let index = 0
  let previous = instant(unit.receivedAt)

  for (let q = 0; q < bounds.length; q++) {
    let events = 0
    let quantity = 0
    // The event that crosses a boundary belongs to the quarter it completes.
    while (index < doses.length && (cumulative < total * bounds[q] || q === bounds.length - 1)) {
      cumulative += doses[index].amount
      quantity += doses[index].amount
      events++
      index++
      if (q < bounds.length - 1 && cumulative >= total * bounds[q]) break
    }
    const at = index > 0 ? instant(doses[index - 1].at) : previous
    out.push({ label: labels[q], events, quantity, elapsed: Math.max(0, at - previous) })
    previous = at
  }

  return out
}

// ---------------------------------------------------------------------------
// the unit report

export type UnitReport = {
  unit: UnitRecord
  /** Received → closed, or received → now for a unit still open. */
  duration: number
  open: boolean
  events: number
  quantifiedEvents: number
  unquantifiedEvents: number
  voidedEvents: number
  quantified: number
  measured: number
  meanDose: number | null
  medianDose: number | null
  smallestDose: number | null
  largestDose: number | null
  doseSpread: number | null
  meanInterval: number | null
  medianInterval: number | null
  shortestInterval: number | null
  longestInterval: number | null
  window: Window | null
  windowHours: number
  quarters: Quarter[] | null
  /** initial − everything accounted for. Positive: material unexplained. */
  unaccounted: number
  coverage: number
  /**
   * The mean of the unquantified events, but only where closing said the
   * unaccounted material was theirs. Derived, and flagged as derived.
   */
  impliedUnquantifiedDose: number | null
}

export function reportOn(unit: UnitRecord, spanHours = WINDOW_HOURS, now = Date.now()): UnitReport {
  const doses = quantifiedDoses(unit)
  const amounts = doses.map((d) => d.amount)
  const times = live(unit).map((i) => i.occurredAt)
  const gaps = intervals(times)
  const t = unit.tally

  const ended = unit.closure ? instant(unit.closure.closedAt) : now
  const unexplained = unit.quantity - (t.quantifiedQuantity + t.adjustedOut - t.adjustedIn)

  return {
    unit,
    duration: Math.max(0, ended - instant(unit.receivedAt)),
    open: unit.status === 'active',
    events: t.events,
    quantifiedEvents: t.measured + t.estimated,
    unquantifiedEvents: t.unquantified,
    voidedEvents: t.voided,
    quantified: t.quantifiedQuantity,
    measured: t.measuredQuantity,
    meanDose: mean(amounts),
    medianDose: median(amounts),
    smallestDose: amounts.length ? Math.min(...amounts) : null,
    largestDose: amounts.length ? Math.max(...amounts) : null,
    doseSpread: stdev(amounts),
    meanInterval: mean(gaps),
    medianInterval: median(gaps),
    shortestInterval: gaps.length ? Math.min(...gaps) : null,
    longestInterval: gaps.length ? Math.max(...gaps) : null,
    window: densestWindow(times, spanHours),
    windowHours: spanHours,
    quarters: burnQuarters(unit),
    unaccounted: unexplained,
    coverage: t.coverage,
    impliedUnquantifiedDose:
      unit.closure?.reconciliation === 'attributed-to-unquantified' &&
      t.unquantified > 0 &&
      unexplained > 0
        ? unexplained / t.unquantified
        : null,
  }
}

// ---------------------------------------------------------------------------
// across units

export type Histogram = { from: number; to: number; count: number }[]

/**
 * Equal-width bins over a set of values.
 *
 * Equal-width rather than equal-count: a quantile histogram hides exactly the
 * thing a dose distribution is looked at for, which is whether the mass sits in
 * one place or two.
 */
export function histogram(values: number[], bins = 12): Histogram {
  if (!values.length) return []
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  if (hi === lo) return [{ from: lo, to: hi, count: values.length }]
  const width = (hi - lo) / bins
  const out: Histogram = Array.from({ length: bins }, (_, i) => ({
    from: lo + i * width,
    to: lo + (i + 1) * width,
    count: 0,
  }))
  for (const v of values) {
    const at = Math.min(bins - 1, Math.floor((v - lo) / width))
    out[at].count++
  }
  return out
}

export type SubstanceStats = {
  substance: string
  /** The uom the figures are in — the one most of this substance's units use. */
  uom: string
  units: number
  closedUnits: number
  events: number
  quantifiedEvents: number
  unquantifiedEvents: number
  quantified: number
  meanDose: number | null
  medianDose: number | null
  meanUnitDuration: number | null
  medianUnitDuration: number | null
  /** Closed units whose whole life was under 24 hours. */
  withinADay: number
  doses: number[]
  /** Mean quantified dose per closed unit, oldest first — the trend line. */
  trend: { unit: string; receivedAt: string; meanDose: number | null; duration: number }[]
}

/** Group by substance, case-folded, so `Cocaine` and `cocaine` are one row. */
export const substanceKey = (name: string) => name.trim().toLowerCase()

export function bySubstance(ledger: Ledger, now = Date.now()): SubstanceStats[] {
  const groups = new Map<string, UnitRecord[]>()
  for (const unit of ledger.units) {
    const key = substanceKey(unit.substance)
    const list = groups.get(key)
    if (list) list.push(unit)
    else groups.set(key, [unit])
  }

  const out: SubstanceStats[] = []
  for (const [key, units] of groups) {
    // Report in whichever uom the most units of this substance were bought in;
    // converting a tablet count into grams would be the invention this ledger
    // refuses, so units in another dimension simply do not contribute doses.
    const uom = commonest(units.map((u) => u.uom))
    const doses: number[] = []
    const durations: number[] = []
    const trend: SubstanceStats['trend'] = []
    let events = 0
    let quantifiedEvents = 0
    let unquantifiedEvents = 0
    let quantified = 0
    let withinADay = 0
    let closedUnits = 0

    for (const unit of [...units].sort((a, b) => instant(a.receivedAt) - instant(b.receivedAt))) {
      const report = reportOn(unit, WINDOW_HOURS, now)
      events += report.events
      quantifiedEvents += report.quantifiedEvents
      unquantifiedEvents += report.unquantifiedEvents

      const unitDoses = unit.uom === uom ? quantifiedDoses(unit).map((d) => d.amount) : []
      doses.push(...unitDoses)
      if (unit.uom === uom) quantified += report.quantified

      if (unit.status === 'closed') {
        closedUnits++
        durations.push(report.duration)
        if (report.duration < 24 * HOUR) withinADay++
        trend.push({
          unit: unit.id,
          receivedAt: unit.receivedAt,
          meanDose: mean(unitDoses),
          duration: report.duration,
        })
      }
    }

    out.push({
      substance: units[0].substance,
      uom,
      units: units.length,
      closedUnits,
      events,
      quantifiedEvents,
      unquantifiedEvents,
      quantified,
      meanDose: mean(doses),
      medianDose: median(doses),
      meanUnitDuration: mean(durations),
      medianUnitDuration: median(durations),
      withinADay,
      doses,
      trend,
    })
    void key
  }

  return out.sort((a, b) => b.events - a.events)
}

function commonest(values: string[]): string {
  const counts = new Map<string, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best = values[0] ?? 'g'
  let top = 0
  for (const [value, count] of counts) {
    if (count > top) {
      top = count
      best = value
    }
  }
  return best
}

/** Events per hour of the local clock, 0–23. A count, nothing else. */
export function byHour(ledger: Ledger): number[] {
  const out = new Array(24).fill(0)
  for (const unit of ledger.units) for (const i of live(unit)) out[localHour(i.occurredAt)]++
  return out
}

/** Events per day of the local week, Sunday first. */
export function byWeekday(ledger: Ledger): number[] {
  const out = new Array(7).fill(0)
  for (const unit of ledger.units) for (const i of live(unit)) out[localDay(i.occurredAt)]++
  return out
}

/** Every live intake in the ledger, newest first — the flat feed. */
export function allIntakes(ledger: Ledger): { unit: UnitRecord; intake: IntakeRecord }[] {
  const out: { unit: UnitRecord; intake: IntakeRecord }[] = []
  for (const unit of ledger.units) for (const intake of live(unit)) out.push({ unit, intake })
  return out.sort((a, b) => instant(b.intake.occurredAt) - instant(a.intake.occurredAt))
}

// ---------------------------------------------------------------------------
// presentation of durations, which every report needs and nothing else owns

export function duration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const minutes = Math.round(ms / MINUTE)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours < 48) return rest ? `${hours}h ${rest}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}
