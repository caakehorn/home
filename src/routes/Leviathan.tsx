import { Link, useParams } from 'react-router-dom'
import { Marquee } from '../components/Marquee'
import { Nav } from '../components/Nav'
import { SubHead } from '../components/Wordmark'
import { sectionBySlug } from '../content/sections'
import { INSTRUMENTS, WINGS, countBy, instrumentById, instrumentsIn } from '../leviathan/core'
import type { Instrument, InstrumentStatus } from '../leviathan/core'
import { Accretion } from '../leviathan/instruments/Accretion'
import { Chronology } from '../leviathan/instruments/Chronology'
import { Clock } from '../leviathan/instruments/Clock'
import { Mass } from '../leviathan/instruments/Mass'
import { Pen } from '../leviathan/instruments/Pen'
import { Pulse } from '../leviathan/instruments/Pulse'
import { Silence } from '../leviathan/instruments/Silence'
import './leviathan.css'

/** The rack knows which component an id belongs to; the registry stays data. */
const BUILT: Record<string, typeof Mass> = {
  mass: Mass,
  accretion: Accretion,
  chronology: Chronology,
  pen: Pen,
  clock: Clock,
  pulse: Pulse,
  silence: Silence,
}

/**
 * What each status means, in the one line the rack has room for. The long
 * version is on the instrument's own card, in its own words: `needs` for the
 * dark ones, `bars` for the ones that are not coming.
 */
const LEGEND: Record<InstrumentStatus, string> = {
  LIVE: 'built here, wired to a dataset that ships',
  PORTED: 'came across under another name — the card says where',
  UNBUILT: 'the corpus is already here; nobody has built the instrument',
  SEALED: 'waiting on a corpus this site does not carry',
  BARRED: 'it makes a judgement, and THE RULE forbids one',
}

const section = sectionBySlug('leviathan')!

/**
 * The wing: the whole old console as a rack, and the room each built one runs in.
 *
 * The original is thirty-seven instruments over two sections plus an unlisted
 * third page, each one a hand-wired page that loaded its own payload and drew
 * its own chrome. All of them are in this registry — not just the four that got
 * rebuilt — because a rack that lists only what is finished cannot tell you
 * what is missing, and the missing is most of the story. Every dark instrument
 * says which kind of dark it is and why, in its own words.
 */
export function LeviathanRoute() {
  const { id } = useParams()

  if (id) {
    const instrument = instrumentById(id)
    const View = instrument ? BUILT[instrument.id] : undefined

    if (!instrument) {
      return (
        <Wing>
          <div className="wrap lev__missing">
            <h1 className="lev__title">
              <SubHead>NO SUCH INSTRUMENT</SubHead>
            </h1>
            <Link to="/leviathan" className="lev__back">
              ← BACK TO THE RACK
            </Link>
          </div>
        </Wing>
      )
    }

    if (!View) return <Dark instrument={instrument} />

    return (
      <Wing>
        <div className="wrap lev__stage">
          <View instrument={instrument} />
        </div>
      </Wing>
    )
  }

  return (
    <Wing>
      <header className="wrap lev__masthead">
        <h1 className="lev__mast-title">
          <SubHead>LEVIATHAN</SubHead>
        </h1>
        <span className="lev__mast-kana jp" aria-hidden="true">
          {section.kana}
        </span>
        <p className="lev__mast-note">
          {section.blurb} The whole old console is racked here — all{' '}
          {INSTRUMENTS.filter((i) => i.wing !== 'HOUSE').length} of it, both sections and the
          unlisted third page — beside the {countBy('LIVE')} this house built. {countBy('LIVE')} are
          wired to a dataset that ships with this site. {countBy('UNBUILT')} need nothing but
          building. {countBy('SEALED')} wait on a corpus that does not ship. {countBy('BARRED')} are
          not coming, and say why.
        </p>
        <p className="lev__rule">
          <b>THE RULE</b> — no instrument here makes a judgement. Every number is a count, a date or
          a length, taken over the whole corpus with nothing excluded and nothing weighted. No
          sentiment scoring, no keyword list, no threshold chosen for what it would surface.
          Anything editorial would make the output a portrait of an argument; left alone, the counts
          make a portrait of the thing itself.
        </p>
        <p className="lev__mast-note">
          The old site did not run that rule over its own corpus half, which is why eighteen of
          these are <b>BARRED</b> rather than merely dark. There are photographs of a dozen of them
          still running, in their own colours, in <Link to="/gallery">THE GALLERY</Link>.
        </p>
        <ul className="lev__legend">
          {(Object.keys(LEGEND) as InstrumentStatus[]).map((status) => (
            <li key={status}>
              <span className={`lev__badge lev__badge--${status.toLowerCase()}`}>{status}</span>
              <span className="lev__legend-say">{LEGEND[status]}</span>
              <span className="lev__legend-n">{countBy(status)}</span>
            </li>
          ))}
        </ul>
      </header>

      {WINGS.map((wing) => (
        <section key={wing.id} className="wrap lev__wing">
          <h2 className="lev__wing-title">
            {wing.title}
            <span className="jp lev__wing-kana" aria-hidden="true">
              {wing.kana}
            </span>
            <span className="lev__wing-n">{instrumentsIn(wing.id).length}</span>
          </h2>
          <p className="lev__wing-note">{wing.note}</p>

          <ol className="lev__rack">
            {instrumentsIn(wing.id).map((i) => (
              <li key={i.id}>
                <Card instrument={i} />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </Wing>
  )
}

/**
 * A card is a link to wherever the instrument actually is: its own room if it
 * is built, the room it became if it was ported, and its reason page otherwise.
 */
function Card({ instrument: i }: { instrument: Instrument }) {
  const lit = i.status === 'LIVE'
  const to = i.status === 'PORTED' && i.portedTo ? i.portedTo : `/leviathan/${i.id}`
  return (
    <Link to={to} className={`lev__card${lit ? '' : ' lev__card--dark'}`}>
      <span className="lev__card-numeral" aria-hidden="true">
        {i.numeral}
      </span>
      <h3 className="lev__card-title">
        {i.title}
        <span className="jp lev__card-kana" aria-hidden="true">
          {i.kana}
        </span>
      </h3>
      <p className="lev__card-corpus">{i.corpus}</p>
      <p className="lev__card-blurb">{i.blurb}</p>
      <span className={`lev__badge lev__badge--${i.status.toLowerCase()}`}>{i.status}</span>
    </Link>
  )
}

/** Every instrument that does not draw gets the same page: what it is, and why it is dark. */
function Dark({ instrument: i }: { instrument: Instrument }) {
  return (
    <Wing>
      <div className="wrap lev__sealed">
        <span className="lev__numeral" aria-hidden="true">
          {i.wing} · {i.numeral}
        </span>
        <h1 className="lev__title">
          <SubHead>{i.title}</SubHead>
        </h1>
        <p className="lev__blurb">{i.blurb}</p>
        <p className="lev__method">
          <b>METHOD</b> — {i.method}
        </p>

        {i.status === 'PORTED' && i.portedTo && (
          <p className="lev__needs">
            <b>PORTED</b> — this one came across. It runs in this building under this house's own
            name and lives at <Link to={i.portedTo}>{i.portedTo}</Link>.
          </p>
        )}
        {i.status === 'UNBUILT' && (
          <p className="lev__needs">
            <b>UNBUILT</b> — {i.needs}. The frame is built and the rack is wired; this one is
            somebody sitting down and doing it.
          </p>
        )}
        {i.status === 'SEALED' && (
          <p className="lev__needs">
            <b>SEALED</b> — this instrument needs {i.needs}. The frame is built and the rack is
            wired; it lights up the day the dataset lands, and not before.
          </p>
        )}
        {i.status === 'BARRED' && (
          <p className="lev__needs lev__needs--barred">
            <b>BARRED</b> — {i.bars} It is listed because leaving it out would be a nicer story than
            the one the old repo actually tells.
          </p>
        )}

        {i.origin && (
          <p className="lev__origin">
            <b>OVER THERE</b> — {i.origin}
          </p>
        )}

        <Link to="/leviathan" className="lev__back">
          ← BACK TO THE RACK
        </Link>
      </div>
    </Wing>
  )
}

function Wing({ children }: { children: React.ReactNode }) {
  return (
    <div className="lev" style={{ ['--glow' as string]: `var(--n${section.accent})` }}>
      <Nav />
      <Marquee text={section.chant} duration={20} tone={section.accent} size="clamp(0.75rem, 1.6vw, 1.05rem)" />
      {children}
    </div>
  )
}
