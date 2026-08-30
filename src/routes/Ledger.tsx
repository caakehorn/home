import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Nav } from '../components/Nav'
import { SubHead } from '../components/Wordmark'
import { Closing } from '../ledger/Closing'
import { LogSheet } from '../ledger/LogSheet'
import { NewUnit, UnitCard, emptyMessage } from '../ledger/Capture'
import { Report } from '../ledger/Report'
import { Trends } from '../ledger/Trends'
import { Instant, pluralise, since } from '../ledger/bits'
import { loadLedger, record, sync, type LedgerState } from '../ledger/sync'
import type { LedgerEvent } from '../ledger/events'
import './ledger.css'

/**
 * THE INTAKE LEDGER — a finite object enters the record, and everything known
 * about where it went is recorded against it.
 *
 * Every other room in this building reads the corpus. This one writes to it,
 * and it writes the one class of fact the corpus is worst at holding: what
 * actually happened, at the hour it happened, rather than what was remembered
 * about it afterwards. `wiki/health/cocaine` currently states a dosage arc of
 * "1 g → 3.5–7 g → 0.5–1 g" reconstructed from memory across twenty years.
 * This is the instrument that would have measured it.
 *
 * ---- why it is not in the nav ------------------------------------------------
 *
 * Deliberately. It is behind the same door as everything else, but it is not a
 * chip in the bar beside THE ARCADE, because a front page that advertises this
 * is a different object from one that holds it. The URL is the affordance: on a
 * phone it is meant to be added to the home screen, which makes logging a dose
 * two taps from a locked device — and two taps is the entire design constraint
 * this tool lives or dies by.
 *
 * ---- local first, always -----------------------------------------------------
 *
 * The screen renders from IndexedDB and never waits on the network for
 * anything. Sync runs behind it, retries, and reports what it could not do in
 * a badge. An unreachable GitHub costs the reader a badge, not an event.
 */
export function LedgerRoute() {
  const { unit: focused } = useParams()
  const navigate = useNavigate()

  const [state, setState] = useState<LedgerState | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [sheet, setSheet] = useState<{ kind: 'log' | 'close'; unit: string } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncNote, setSyncNote] = useState<string | null>(null)
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [pane, setPane] = useState<'units' | 'trends'>('units')

  /**
   * Push and pull, without ever letting the result reach an error boundary.
   *
   * The local log is complete on its own, so a sync failure is a footnote. It
   * is reported as one — never as a screen the reader has to dismiss before
   * they can log a dose.
   */
  const push = useCallback(async () => {
    setSyncing(true)
    try {
      const report = await sync()
      const stuck = report.problems.length > 0
      setSyncNote(
        stuck
          ? report.problems[0]
          : report.pushed || report.pulled
            ? `${report.pushed} up · ${report.pulled} down`
            : null,
      )
      // Only a clean pass sets the timestamp. A badge reading SYNCED above an
      // error is the worst of both — it is the reassurance without the fact,
      // and this is the one screen where "it is only on this phone" has to be
      // impossible to misread.
      if (!stuck) setSyncedAt(report.at)
      if (report.pulled) setState(await loadLedger())
      else if (!stuck) setState((s) => (s ? { ...s, waiting: 0 } : s))
    } catch (error) {
      setSyncNote((error as Error).message)
      setSyncedAt(null)
    } finally {
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    loadLedger()
      .then((next) => {
        setState(next)
        void push()
      })
      .catch((error: Error) => setFailed(error.message))
  }, [push])

  /** Write, re-render, then sync in the background. The button never waits. */
  const commit = useCallback(
    async (events: LedgerEvent[]) => {
      setState(await record(events))
      setSheet(null)
      void push()
    },
    [push],
  )

  if (failed) {
    return (
      <div className="lg">
        <Nav />
        <p className="wrap lg__state">
          The local ledger would not open — {failed}. This is usually a browser in private
          mode, where there is nowhere to keep it.
        </p>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="lg">
        <Nav />
        <p className="wrap lg__state">READING THE LEDGER…</p>
      </div>
    )
  }

  const { ledger } = state
  const open = ledger.units.filter((u) => u.status === 'active')
  const shut = ledger.units.filter((u) => u.status === 'closed')
  const sheetUnit = sheet ? ledger.units.find((u) => u.id === sheet.unit) : null
  const reported = focused ? ledger.units.find((u) => u.id === focused) : null

  return (
    <div className="lg">
      <Nav />

      <header className="wrap lg__masthead">
        <h1 className="lg__mast-title">
          <SubHead>THE INTAKE LEDGER</SubHead>
        </h1>
        <span className="lg__mast-kana jp" aria-hidden="true">
          出納
        </span>
        <p className="lg__mast-note">
          A finite object enters the record. Every known disposition of it is recorded
          against it. At closure the ledger reconciles what is known, preserves what is
          unknown, and computes only what the evidence supports — which is why several
          figures here are printed as bounds and several are left blank.
        </p>
      </header>

      <div className="wrap lg__bar">
        <span
          className={`lg__sync${syncing ? ' lg__sync--busy' : ''}${
            !syncing && syncNote && !syncedAt ? ' lg__sync--stuck' : ''
          }`}
        >
          {syncing
            ? 'SYNCING…'
            : state.waiting > 0
              ? `${pluralise(state.waiting, 'event')} on this device only`
              : syncedAt
                ? `SYNCED ${since(syncedAt)}`
                : 'THIS DEVICE ONLY'}
        </span>
        {syncNote && <span className="lg__sync-note">{syncNote}</span>}
        <button type="button" className="lg__linkish lg__linkish--end" onClick={() => void push()} disabled={syncing}>
          SYNC NOW
        </button>
      </div>

      {state.problems.length > 0 && (
        <p className="wrap lg__warn">
          {pluralise(state.problems.length, 'line')} of the local log could not be read and
          {state.problems.length === 1 ? ' is' : ' are'} excluded from every figure below:{' '}
          {state.problems.slice(0, 3).join('; ')}
        </p>
      )}

      <nav className="wrap lg__tabs" aria-label="Views">
        <button
          type="button"
          className={`lg__tab${pane === 'units' && !focused ? ' lg__tab--on' : ''}`}
          onClick={() => {
            setPane('units')
            if (focused) navigate('/ledger')
          }}
        >
          UNITS
        </button>
        <button
          type="button"
          className={`lg__tab${pane === 'trends' && !focused ? ' lg__tab--on' : ''}`}
          onClick={() => {
            setPane('trends')
            if (focused) navigate('/ledger')
          }}
        >
          ACROSS UNITS
        </button>
      </nav>

      <main className="wrap lg__body">
        {focused && !reported && (
          <p className="lg__state">
            No unit with that id is in this device's log. It may be on another device and not
            yet synced.
          </p>
        )}

        {reported && (
          <Report
            unit={reported}
            onCommit={(events) => void commit(events)}
            onBack={() => navigate('/ledger')}
          />
        )}

        {!focused && pane === 'trends' && <Trends ledger={ledger} />}

        {!focused && pane === 'units' && (
        <section className="lg__units">
          {open.length === 0 && <p className="lg__empty">{emptyMessage(shut.length)}</p>}
          {open.map((unit) => (
            <UnitCard
              key={unit.id}
              unit={unit}
              onLog={() => setSheet({ kind: 'log', unit: unit.id })}
              onClose={() => setSheet({ kind: 'close', unit: unit.id })}
              onSpill={(events) => void commit(events)}
              onOpenReport={() => navigate(`/ledger/u/${unit.id}`)}
            />
          ))}
          <NewUnit onDone={(events) => void commit(events)} />
        </section>
        )}

        {!focused && pane === 'units' && shut.length > 0 && (
          <section className="lg__closed">
            <h2 className="lg__h2">CLOSED — {shut.length}</h2>
            <ul className="lg__closed-list">
              {shut.map((unit) => (
                <li key={unit.id}>
                  <button type="button" className="lg__closed-row" onClick={() => navigate(`/ledger/u/${unit.id}`)}>
                    <b>{unit.substance}</b>
                    <span>
                      {unit.quantity} {unit.uom}
                    </span>
                    <span>{pluralise(unit.tally.events, 'event')}</span>
                    <span className="lg__closed-when">
                      <Instant iso={unit.receivedAt} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {sheetUnit && sheet?.kind === 'log' && (
        <div className="lg__scrim" onClick={() => setSheet(null)}>
          <div className="lg__sheet-wrap" onClick={(e) => e.stopPropagation()}>
            <LogSheet
              unit={sheetUnit}
              onDone={(events) => void commit(events)}
              onCancel={() => setSheet(null)}
            />
          </div>
        </div>
      )}

      {sheetUnit && sheet?.kind === 'close' && (
        <div className="lg__scrim" onClick={() => setSheet(null)}>
          <div className="lg__sheet-wrap" onClick={(e) => e.stopPropagation()}>
            <Closing
              unit={sheetUnit}
              onDone={(events) => void commit(events)}
              onCancel={() => setSheet(null)}
            />
          </div>
        </div>
      )}

    </div>
  )
}
