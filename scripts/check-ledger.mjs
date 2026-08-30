/**
 * Checks the arithmetic the intake ledger promises not to invent.
 *
 *   node --experimental-strip-types scripts/check-ledger.mjs
 *
 * Three programs parse the ledger's event log — `src/ledger/project.ts` here,
 * `scripts/check-ledger.mjs` (this), and `bin/wiki-intake` in
 * caakehorn/wiki-brain, which is Python and shares no code with either. None of
 * them fails loudly when the shape drifts: a projection that silently drops an
 * event still renders a confident total, which is the worst failure this tool
 * has, because the whole point of it is to be the thing that cannot be argued
 * with.
 *
 * So the properties are asserted rather than trusted, and the ones that matter
 * most are the refusals:
 *
 *   - a unit with unquantified events never reports an exact remainder
 *   - a mean dose is never the initial quantity over the event count
 *   - a voided event leaves every total as though it had never been logged
 *   - a correction changes the figure and keeps the original
 *   - two units of measure from different dimensions never sum
 *
 * No test framework: this repo has none, and one assertion helper is cheaper
 * than a dependency. Exits 1 on any failure.
 */
import {
  mergeLogs, nowLocal, orderLog, parseJsonl, serialize, toJsonl, ulid, validate,
} from '../src/ledger/events.ts'
import {
  amendUnit, adjustUnit, closeUnit, correctIntake, intake as makeIntake, openUnit,
  reopenUnit, voidIntake,
} from '../src/ledger/commands.ts'
import { fromWire } from '../src/ledger/wire.ts'
import { project, unaccounted } from '../src/ledger/project.ts'
import { burnQuarters, densestWindow, median, reportOn } from '../src/ledger/analyze.ts'
import { convert, commensurable, format } from '../src/ledger/uom.ts'

let failures = 0

function check(what, condition, detail = '') {
  if (condition) {
    console.log(`  ok    ${what}`)
  } else {
    failures++
    console.log(`  FAIL  ${what}${detail ? ` — ${detail}` : ''}`)
  }
}

const near = (a, b, epsilon = 1e-9) => Math.abs(a - b) < epsilon

// ---------------------------------------------------------------------------
// a worked unit, built the way the UI builds one

let clock = Date.parse('2026-08-29T13:42:00-04:00')
const tick = (minutes) => {
  clock += minutes * 60_000
  return new Date(clock)
}

/** Local instant for a Date, at a fixed -04:00 so the fixture is stable. */
function at(date) {
  const shifted = new Date(date.getTime() - 4 * 3600_000)
  return `${shifted.toISOString().slice(0, 19)}-04:00`
}

const UNIT = 'intake_unit_TESTFIXTURE0000000'
const events = []
let n = 0
const push = (event) => {
  events.push({
    id: `intake_evt_TESTFIXTURE${String(++n).padStart(7, '0')}`,
    loggedAt: at(new Date(clock)),
    source: { application: 'wiki-brain', tool: 'intake-ledger', interface: 'portal' },
    ...event,
  })
  return events[events.length - 1]
}

push({
  type: 'unit_opened',
  unit: UNIT,
  substance: 'cocaine',
  quantity: 3.5,
  uom: 'g',
  receivedAt: at(new Date(clock)),
  origin: 'test fixture',
})

// Four measured doses, one estimate, one unquantified, one to be voided,
// one to be corrected.
const measured = [0.18, 0.22, 0.31, 0.14]
for (const q of measured) {
  push({
    type: 'intake_logged',
    unit: UNIT,
    occurredAt: at(tick(95)),
    measurement: 'measured',
    quantity: q,
    uom: 'g',
  })
}
push({
  type: 'intake_logged',
  unit: UNIT,
  occurredAt: at(tick(40)),
  measurement: 'estimated',
  quantity: 0.2,
  uom: 'g',
  confidence: 'medium',
})
push({
  type: 'intake_logged',
  unit: UNIT,
  occurredAt: at(tick(35)),
  measurement: 'unquantified',
  descriptor: 'one line',
})
const doubled = push({
  type: 'intake_logged',
  unit: UNIT,
  occurredAt: at(tick(5)),
  measurement: 'measured',
  quantity: 0.2,
  uom: 'g',
})
const slipped = push({
  type: 'intake_logged',
  unit: UNIT,
  occurredAt: at(tick(70)),
  measurement: 'measured',
  quantity: 0.5,
  uom: 'g',
})

push({ type: 'intake_voided', target: doubled.id, reason: 'double tap on the log button' })
push({
  type: 'intake_corrected',
  target: slipped.id,
  reason: 'decimal entry error',
  patch: { quantity: 0.05 },
})
push({
  type: 'unit_adjusted',
  unit: UNIT,
  occurredAt: at(tick(10)),
  quantity: 0.1,
  uom: 'g',
  direction: 'out',
  kind: 'spill',
  reason: 'knocked the tray',
})

console.log('ledger: the event log round-trips')
{
  const text = toJsonl(events)
  const { events: read, problems } = parseJsonl(text)
  check('every fixture line parses', problems.length === 0, problems.join('; '))
  check('nothing is dropped', read.length === events.length, `${read.length} of ${events.length}`)
  check('re-serialising is byte-identical', toJsonl(read) === text)
  check(
    'a duplicated line is collapsed by id',
    parseJsonl(text + serialize(events[0]) + '\n').events.length === events.length,
  )
  check('a corrupt line is named, not swallowed', parseJsonl('{oops\n' + text).problems.length === 1)
}

console.log('ledger: validation refuses what the projection would have to guess')
{
  const base = { id: 'intake_evt_x', loggedAt: '2026-08-29T13:42:00-04:00', source: {} }
  check('an unquantified intake may not carry a quantity', Boolean(validate({
    ...base, type: 'intake_logged', unit: UNIT, occurredAt: base.loggedAt,
    measurement: 'unquantified', quantity: 0.2,
  })))
  check('a quantified intake must carry a uom', Boolean(validate({
    ...base, type: 'intake_logged', unit: UNIT, occurredAt: base.loggedAt,
    measurement: 'measured', quantity: 0.2,
  })))
  check('an instant without an offset is refused', Boolean(validate({
    ...base, type: 'intake_logged', unit: UNIT, occurredAt: '2026-08-29 13:42',
    measurement: 'measured', quantity: 0.2, uom: 'g',
  })))
  check('a correction without a reason is refused', Boolean(validate({
    ...base, type: 'intake_corrected', target: 'evt_y', patch: { quantity: 1 },
  })))
  check('a negative quantity is refused', Boolean(validate({
    ...base, type: 'unit_opened', unit: UNIT, substance: 'x', quantity: -1, uom: 'g',
    receivedAt: base.loggedAt,
  })))
  check('a well-formed intake passes', validate(events[1]) === null, String(validate(events[1])))
}

console.log('ledger: the projection counts what happened and nothing else')
const ledger = project(events)
const unit = ledger.units[0]
const report = reportOn(unit, 6, clock)
{
  check('one unit, no orphans', ledger.units.length === 1 && ledger.orphans.length === 0)
  // 4 measured + 1 estimated + 1 unquantified + 1 corrected measured = 7 live.
  check('the voided event is out of the count', report.events === 7, `events=${report.events}`)
  check('the voided event is still on the record', unit.tally.voided === 1)
  check('the unquantified event is counted', report.unquantifiedEvents === 1)
  check('the unquantified event contributes no quantity', report.quantifiedEvents === 6)

  // 0.18 + 0.22 + 0.31 + 0.14 + 0.05 measured = 0.90; + 0.2 estimated = 1.10.
  check('measured total', near(report.measured, 0.9, 1e-9), String(report.measured))
  check('quantified total', near(report.quantified, 1.1, 1e-9), String(report.quantified))
  check(
    'the corrected dose is 0.05, not 0.5',
    unit.intakes.find((i) => i.id === slipped.id).quantity === 0.05,
  )
  check(
    'the original 0.5 survives as provenance',
    unit.intakes.find((i) => i.id === slipped.id).corrections[0].before.quantity === 0.5,
  )
}

console.log('ledger: the refusals')
{
  // 3.5 − 1.10 quantified − 0.10 spilled = 2.30, and it is an upper bound only.
  check('remaining is a bound', near(unit.tally.remainingAtMost, 2.3, 1e-9),
    String(unit.tally.remainingAtMost))
  check(
    'the bound is NOT called exact while an unquantified event stands',
    unit.tally.remainingExact === false,
  )
  check('unaccounted material is named', near(unaccounted(unit), 2.3, 1e-9))

  // The number this design exists to never produce: 3.5 / 7 = 0.5.
  check(
    'the mean dose is over quantified events, not all of them',
    near(report.meanDose, 1.1 / 6, 1e-9),
    String(report.meanDose),
  )
  check('the mean dose is not initial ÷ events', !near(report.meanDose, 3.5 / 7, 1e-6))
  check('the median is over the same six', near(report.medianDose, median([0.18, 0.22, 0.31, 0.14, 0.2, 0.05]), 1e-9))
  check('the largest dose is real', report.largestDose === 0.31)
  check('the smallest dose is the corrected one', report.smallestDose === 0.05)
  check('coverage is stated', near(report.coverage, 1.1 / 3.5, 1e-9))

  const empty = project([events[0]]).units[0]
  check('a unit with no intakes reports no mean', reportOn(empty, 6, clock).meanDose === null)
  check('a unit with no intakes has an exact remainder', empty.tally.remainingExact === true)
  check('a unit with no intakes is whole', near(empty.tally.remainingAtMost, 3.5))
}

console.log('ledger: closing reconciles rather than assumes')
{
  const closed = project([
    ...events,
    {
      id: 'intake_evt_TESTFIXTURECLOSE00',
      type: 'unit_closed',
      loggedAt: at(new Date(clock)),
      unit: UNIT,
      closedAt: at(new Date(clock)),
      disposition: 'consumed',
      reconciliation: 'final_intake',
      unaccounted: 2.3,
      uom: 'g',
      source: { application: 'wiki-brain', tool: 'intake-ledger', interface: 'portal' },
    },
  ]).units[0]
  const shut = reportOn(closed, 6, clock)
  check('a closed unit stops the clock', shut.open === false)
  // The fifth reconciliation this portal used to offer — "the unquantified
  // events took the remainder" — is gone rather than forked into upstream's
  // format, so nothing is ever derived from one.
  check('no reconciliation derives a figure any more', shut.impliedUnquantifiedDose === null)
  check('the quantified mean is untouched by closing', near(shut.meanDose, 1.1 / 6, 1e-9))

  const discrepancy = project([
    ...events,
    {
      id: 'intake_evt_TESTFIXTURECLOSE01',
      type: 'unit_closed',
      loggedAt: at(new Date(clock)),
      unit: UNIT,
      closedAt: at(new Date(clock)),
      disposition: 'consumed',
      reconciliation: 'discrepancy',
      unaccounted: 2.3,
      uom: 'g',
      source: { application: 'wiki-brain', tool: 'intake-ledger', interface: 'portal' },
    },
  ]).units[0]
  check(
    'recording the gap as a discrepancy derives nothing at all',
    reportOn(discrepancy, 6, clock).impliedUnquantifiedDose === null,
  )
}

console.log('ledger: units of measure')
{
  check('g to mg', convert(3.5, 'g', 'mg') === 3500)
  check('mg to g', convert(500, 'mg', 'g') === 0.5)
  check('mass and volume do not mix', convert(1, 'g', 'ml') === null)
  check('mass and count do not mix', convert(1, 'g', 'tab') === null)
  check('a tablet is a count', convert(3, 'tab', 'ct') === 3)
  // Upstream lets every count unit convert to every other. A tablet is not a
  // puff, but the ledger is unit-agnostic and a count is a count — and a table
  // that disagreed with theirs would accept rows their rebuild rejects.
  check('count converts freely, as it does upstream', convert(1, 'tab', 'cap') === 1)
  check('micrograms are grams', convert(1000, 'mcg', 'mg') === 1)
  check('commensurability agrees', commensurable('g', 'kg') && !commensurable('g', 'ml'))
  check('display drops invented precision', format(0.18, 'g') === '0.18')
  check('display keeps real zeros', format(3, 'g') === '3')

  // A dose logged in a dimension the unit cannot absorb is counted, named, and
  // kept out of every sum.
  const mixed = project([
    events[0],
    {
      id: 'intake_evt_TESTFIXTUREMIXED0',
      type: 'intake_logged',
      loggedAt: at(new Date(clock)),
      unit: UNIT,
      occurredAt: at(new Date(clock)),
      measurement: 'measured',
      quantity: 2,
      uom: 'tab',
      source: { application: 'wiki-brain', tool: 'intake-ledger', interface: 'portal' },
    },
  ]).units[0]
  check('an unconvertible dose is counted as an event', mixed.tally.events === 1)
  check('an unconvertible dose adds nothing to the total', mixed.tally.quantifiedQuantity === 0)
  check('an unconvertible dose is named', mixed.tally.unconvertible === 1)
  check('an unconvertible dose voids the exactness claim', mixed.tally.remainingExact === false)
}

console.log('ledger: time')
{
  const window = densestWindow(
    ['2026-08-30T23:00:00-04:00', '2026-08-30T23:40:00-04:00', '2026-08-31T01:10:00-04:00',
     '2026-08-31T03:50:00-04:00', '2026-08-31T14:00:00-04:00'],
    6,
  )
  check('the densest window straddles midnight', window.events === 4, JSON.stringify(window))

  const quarters = burnQuarters(unit)
  check('quarters exist once there are four quantified doses', quarters && quarters.length === 4)
  check(
    'the quarters account for every quantified dose',
    near(quarters.reduce((a, q) => a + q.quantity, 0), 1.1, 1e-9),
  )
  check(
    'the quarters account for every quantified event',
    quarters.reduce((a, q) => a + q.events, 0) === 6,
  )
  check('three doses are not four quarters', burnQuarters(project([
    events[0], events[1], events[2], events[3],
  ]).units[0]) === null)

  check('a local instant keeps its offset', /[+-]\d{2}:\d{2}$/.test(nowLocal()))
  check('ids sort by creation', ulid(new Date(1)) < ulid(new Date(2)))
  check('ids of the same millisecond still differ', ulid(new Date(1)) !== ulid(new Date(1)))
}

console.log('ledger: the commands claim less than they are told, never more')
{
  const { event: opened, unit: fresh } = openUnit({ substance: 'cocaine', quantity: 3.5, uom: 'g' })
  check('opening a unit mints an id', fresh.startsWith('intake_unit_') && opened.unit === fresh)
  check('opening a unit stamps a received time', Boolean(opened.receivedAt))

  const zero = makeIntake({ unit: fresh, quantity: 0 })
  check('a zero quantity is unquantified, not a dose of zero', zero.measurement === 'unquantified')
  check('a zero quantity carries no number at all', zero.quantity === undefined)

  const blank = makeIntake({ unit: fresh, quantity: null, descriptor: 'one line' })
  check('an empty box is unquantified', blank.measurement === 'unquantified')
  check('the words are kept', blank.descriptor === 'one line')

  const real = makeIntake({ unit: fresh, quantity: 0.18, uom: 'g' })
  check('a number defaults to measured', real.measurement === 'measured')
  check('a measured dose carries no confidence', real.confidence === undefined)

  const guess = makeIntake({ unit: fresh, quantity: 0.2, uom: 'g', measurement: 'estimated' })
  check('an estimate without a stated confidence gets one', guess.confidence === 'medium')

  const lying = makeIntake({ unit: fresh, quantity: NaN, uom: 'g', measurement: 'measured' })
  check('a NaN cannot become a measurement', lying.measurement === 'unquantified')

  check('there is no delete', typeof globalThis.deleteIntake === 'undefined')
  check('a correction demands a reason',
    (() => { try { correctIntake('evt_x', { quantity: 1 }, '  '); return false } catch { return true } })())
  check('voiding demands a reason',
    (() => { try { voidIntake('evt_x', ''); return false } catch { return true } })())
  check('an amendment demands a reason',
    (() => { try { amendUnit(fresh, 'intake_evt_x', { quantity: 3 }, ''); return false } catch { return true } })())
  check('reopening demands a reason',
    (() => { try { reopenUnit(fresh, ''); return false } catch { return true } })())
  check('an adjustment demands a reason',
    (() => { try { adjustUnit({ unit: fresh, quantity: 0.1, uom: 'g', reason: '' }); return false }
             catch { return true } })())

  // A reconstructed last dose is a dose. Burying it in the closure would keep
  // it out of every dose statistic, which is the quiet loss this design exists
  // to prevent.
  const reconstructed = closeUnit({
    unit: fresh, disposition: 'consumed', reconciliation: 'final_intake',
    unaccounted: 0.66, uom: 'g',
  })
  check('reconstructing a last dose writes a dose AND a closure', reconstructed.length === 2)
  check('the dose comes first', reconstructed[0].type === 'intake_logged')
  check('the reconstructed dose is an estimate of low confidence',
    reconstructed[0].measurement === 'estimated' && reconstructed[0].confidence === 'low')
  // Upstream's own sentence for this row, verbatim, so the two interfaces
  // produce the same record of the same decision.
  check('the reconstructed dose says so', /reconciliation at close/.test(reconstructed[0].note ?? ''))

  const plain = closeUnit({ unit: fresh, disposition: 'consumed', reconciliation: 'discrepancy',
    unaccounted: 0.66, uom: 'g' })
  check('recording a discrepancy invents no dose', plain.length === 1)

  const lost = closeUnit({ unit: fresh, disposition: 'discarded' })
  check('a discarded unit closes without reconciliation', lost.length === 1 && !lost[0].reconciliation)
}

console.log('ledger: reopening is a different history from never having closed')
{
  const shut = {
    id: 'intake_evt_TESTFIXTURECLOSE02', type: 'unit_closed', loggedAt: at(new Date(clock)),
    unit: UNIT, closedAt: at(new Date(clock)), disposition: 'consumed',
    reconciliation: 'discrepancy', unaccounted: 2.3, uom: 'g',
    source: { application: 'wiki-brain', tool: 'intake-ledger', interface: 'portal' },
  }
  const back = {
    id: 'intake_evt_TESTFIXTUREREOPEN', type: 'unit_reopened', loggedAt: at(tick(5)),
    unit: UNIT, reason: 'closed it by mistake',
    source: { application: 'wiki-brain', tool: 'intake-ledger', interface: 'portal' },
  }
  const reopened = project([...events, shut, back]).units[0]
  check('a reopened unit is active again', reopened.status === 'active')
  // The closure is deliberately NOT cleared. A unit that was closed and
  // reopened is a different history from one that was never closed, and the
  // report goes on showing how it ended.
  check('the closure stays on the record', reopened.closure !== null)
  check('the closure keeps what it said', reopened.closure.disposition === 'consumed')
  check(
    'reopening reopens the right unit only',
    project([...events, shut, { ...back, unit: 'unit_OTHER' }]).units[0].status === 'closed',
  )
}

console.log("ledger: the file is bin/intake's file, not this portal's")
{
  // Every key here was read off `bin/intake` in caakehorn/wiki-brain. If that
  // program's `append()` or its `data` payloads move, these fail — which is the
  // whole point of writing them out as literals rather than deriving them.
  // Through `serialize`, not `toWire`: the key order is applied there, and the
  // bytes on disk are the contract rather than the intermediate object.
  const wire = (event) => JSON.parse(serialize(event))

  const opened = wire(openUnit({
    substance: 'Cocaine', substanceId: 'cocaine', category: 'stimulant',
    quantity: 3.5, uom: 'g', origin: 'test',
  }).event)

  check('the envelope is upstream\'s', JSON.stringify(Object.keys(opened)) ===
    JSON.stringify(['id', 'type', 'timestamp', 'occurred_at', 'unit_id', 'data', 'source']))
  check('ids carry upstream\'s prefix', /^intake_evt_[0-9A-HJKMNP-TV-Z]{26}$/.test(opened.id))
  check('unit ids too', /^intake_unit_[0-9A-HJKMNP-TV-Z]{26}$/.test(opened.unit_id))
  check('the source names the interface', opened.source.application === 'wiki-brain' &&
    opened.source.tool === 'intake-ledger' && opened.source.interface === 'portal')

  check('a unit is a unit_created', opened.type === 'unit_created')
  check('its occurred_at is the received time', typeof opened.occurred_at === 'string')
  check('its payload is upstream\'s', JSON.stringify(Object.keys(opened.data).sort()) ===
    JSON.stringify(['category', 'note', 'quantity', 'source_context', 'substance',
                    'substance_id', 'unit']))
  check('the uom is called `unit` upstream', opened.data.unit === 'g')
  check('the origin is called `source_context`', opened.data.source_context === 'test')

  const dose = wire(makeIntake({ unit: UNIT, quantity: 0.18, uom: 'g' }))
  check('a dose is an intake_logged', dose.type === 'intake_logged')
  check('its payload is upstream\'s', JSON.stringify(Object.keys(dose.data).sort()) ===
    JSON.stringify(['confidence', 'descriptor', 'measurement', 'note', 'quantity', 'unit']
      .filter((k) => k !== 'measurement').concat('measurement_type').sort()))
  check('the class is `measurement_type`', dose.data.measurement_type === 'measured')

  const words = wire(makeIntake({ unit: UNIT, descriptor: 'one line' }))
  check('an unquantified dose carries a null quantity, not a missing one',
    words.data.quantity === null && words.data.measurement_type === 'unquantified')

  const fixed = wire(correctIntake('intake_evt_x', { quantity: 0.05 }, 'decimal entry error'))
  check('a correction is an event_corrected', fixed.type === 'event_corrected')
  check('it carries target/fields/reason', JSON.stringify(Object.keys(fixed.data).sort()) ===
    JSON.stringify(['fields', 'reason', 'target']))
  check('the corrected value is under `fields`', fixed.data.fields.quantity === 0.05)

  const gone = wire(voidIntake('intake_evt_x', 'double tap'))
  check('a void is an event_voided', gone.type === 'event_voided')

  const spilt = wire(adjustUnit({ unit: UNIT, quantity: 0.1, uom: 'g', kind: 'spill',
    reason: 'knocked the tray' }))
  check('an adjustment is upstream\'s shape', JSON.stringify(Object.keys(spilt.data).sort()) ===
    JSON.stringify(['kind', 'note', 'quantity', 'unit']))
  check('the reason is called `note`', spilt.data.note === 'knocked the tray')
  const back = wire(adjustUnit({ unit: UNIT, quantity: 0.1, uom: 'g', direction: 'in',
    kind: 'found', reason: 'turned up' }))
  check('direction is carried by the kind, as upstream has no such field',
    back.data.kind === 'found' && !('direction' in back.data))

  const shut = wire(closeUnit({ unit: UNIT, disposition: 'consumed',
    reconciliation: 'discrepancy', unaccounted: 0.66, uom: 'g' })[0])
  check('a closure is a unit_closed', shut.type === 'unit_closed')
  check('reconciliation is a record, not a string', typeof shut.data.reconciliation === 'object')
  check('and it names the resolution', shut.data.reconciliation.resolution === 'discrepancy')
  check('a balanced close says so', wire(closeUnit({ unit: UNIT, disposition: 'consumed' })[0])
    .data.reconciliation.resolution === 'balanced')

  // Round trip: what goes out has to come back as the same event.
  for (const original of events) {
    const back = fromWire(JSON.parse(serialize(original)))
    if (!back) { check(`round trip ${original.type}`, false, 'came back null'); continue }
    check(`round trip ${original.type}`, back.id === original.id && back.type === original.type)
  }

  // A row upstream wrote that this portal has no use for is skipped, not broken.
  check('substance_added is skipped rather than failing', fromWire({
    id: 'intake_evt_x', type: 'substance_added', timestamp: at(new Date(clock)),
    occurred_at: at(new Date(clock)), unit_id: null,
    data: { id: 'kratom', name: 'Kratom' }, source: {},
  }) === null)
  check('and the parser does not call it a problem',
    parseJsonl(JSON.stringify({ id: 'intake_evt_y', type: 'substance_added',
      timestamp: at(new Date(clock)), occurred_at: at(new Date(clock)), unit_id: null,
      data: {}, source: {} }) + '\n').problems.length === 0)
}

console.log('ledger: the log file converges no matter who writes it')
{
  const half = events.slice(0, 6)
  const other = events.slice(4)
  const a = mergeLogs(half, other)
  const b = mergeLogs(other, half)
  check('a union is a union whichever way round', toJsonl(a) === toJsonl(b))
  check('a union loses nothing', a.length === events.length)
  check('merging with itself is a no-op', toJsonl(mergeLogs(events, events)) === toJsonl(orderLog(events)))
  check(
    'a shuffled log serialises identically',
    toJsonl(orderLog([...events].reverse())) === toJsonl(orderLog(events)),
  )

}

console.log('')
if (failures) {
  console.log(`ledger: ${failures} FAILED`)
  process.exit(1)
}
console.log('ledger: all checks passed')
