import { Link, useParams } from 'react-router-dom'
import { Marquee } from '../components/Marquee'
import { Nav } from '../components/Nav'
import { SubHead } from '../components/Wordmark'
import { sectionBySlug } from '../content/sections'
import { INSTRUMENTS, instrumentById } from '../leviathan/core'
import { Chronology } from '../leviathan/instruments/Chronology'
import { Mass } from '../leviathan/instruments/Mass'
import { Pen } from '../leviathan/instruments/Pen'
import './leviathan.css'

/** The rack knows which component an id belongs to; the registry stays data. */
const BUILT: Record<string, typeof Mass> = {
  mass: Mass,
  chronology: Chronology,
  pen: Pen,
}

const section = sectionBySlug('leviathan')!

/**
 * The wing: a rack of instruments and the room each one runs in.
 *
 * The old site opened on a console listing thirty-seven of these. This is the
 * same idea rebuilt as a registry — an instrument is a row of data until it
 * has a component, which means the ones still waiting on a corpus can be
 * listed honestly rather than pretended at.
 */
export function LeviathanRoute() {
  const { id } = useParams()

  if (id) {
    const instrument = instrumentById(id)
    const View = instrument ? BUILT[instrument.id] : undefined

    if (!instrument || (!View && instrument.status === 'LIVE')) {
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

    if (!View) {
      return (
        <Wing>
          <div className="wrap lev__sealed">
            <span className="lev__numeral" aria-hidden="true">
              {instrument.numeral}
            </span>
            <h1 className="lev__title">
              <SubHead>{instrument.title}</SubHead>
            </h1>
            <p className="lev__blurb">{instrument.blurb}</p>
            <p className="lev__needs">
              <b>SEALED</b> — this instrument needs {instrument.needs}. The frame is built and the
              rack is wired; it lights up the day the dataset lands, and not before.
            </p>
            <Link to="/leviathan" className="lev__back">
              ← BACK TO THE RACK
            </Link>
          </div>
        </Wing>
      )
    }

    return (
      <Wing>
        <div className="wrap lev__stage">
          <View instrument={instrument} />
        </div>
      </Wing>
    )
  }

  const live = INSTRUMENTS.filter((i) => i.status === 'LIVE').length

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
          {section.blurb} {live} of {INSTRUMENTS.length} instruments are wired to a dataset that
          ships with this site; the rest are declared and waiting on a corpus that does not.
        </p>
        <p className="lev__rule">
          <b>THE RULE</b> — no instrument here makes a judgement. Every number is a count, a date or
          a length, taken over the whole corpus with nothing excluded and nothing weighted. No
          sentiment scoring, no keyword list, no threshold chosen for what it would surface.
          Anything editorial would make the output a portrait of an argument; left alone, the counts
          make a portrait of the thing itself.
        </p>
      </header>

      <ol className="wrap lev__rack">
        {INSTRUMENTS.map((i) => {
          const sealed = i.status === 'SEALED'
          return (
            <li key={i.id}>
              <Link to={`/leviathan/${i.id}`} className={`lev__card${sealed ? ' lev__card--sealed' : ''}`}>
                <span className="lev__card-numeral" aria-hidden="true">
                  {i.numeral}
                </span>
                <h2 className="lev__card-title">
                  {i.title}
                  <span className="jp lev__card-kana" aria-hidden="true">
                    {i.kana}
                  </span>
                </h2>
                <p className="lev__card-corpus">{i.corpus}</p>
                <p className="lev__card-blurb">{i.blurb}</p>
                <span className={`lev__badge${sealed ? ' lev__badge--sealed' : ''}`}>
                  {sealed ? 'SEALED' : 'LIVE'}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
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
