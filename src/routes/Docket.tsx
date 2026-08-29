import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Marquee } from '../components/Marquee'
import { Nav } from '../components/Nav'
import { SectionArt } from '../components/SectionArt'
import { SubHead } from '../components/Wordmark'
import { banner } from '../content/slogans'
import { Board } from '../docket/Board'
import { Collisions } from '../docket/Collisions'
import { Field } from '../docket/Field'
import { Rulings } from '../docket/Rulings'
import { BENCHES, useDocket, type BenchId } from '../docket/core'
import './docket.css'

/**
 * THE DOCKET — 未決
 *
 * The room where the wiki is cross-examined by its own record.
 *
 * Every other floor in this building reads the second brain for what it
 * asserts: THE WIKI-BRAIN serves the pages, LEVIATHAN counts over them, THE
 * SAGE answers out of them, THE TRANSCRIPT is the material underneath them all.
 * Nothing showed what it does not know — and the corpus's own standard for an
 * answer, written into `CLAUDE.md`, is that it *"states its own strongest
 * counter-evidence and what would falsify it,"* because an answering system
 * that routes around the parts that do not flatter its subject is one nobody
 * should believe on anything.
 *
 * This is that standard given a floor. Four benches, 1,036 items, every one of
 * them a span of prose the wiki wrote about itself, lifted whole and attributed
 * to the page that wrote it.
 *
 * ---- the room decides nothing ----------------------------------------------
 *
 * It does not resolve a collision, rank a gap, or score a prediction. Those are
 * commits in another repository, made by somebody who has read the sources.
 * What this room does is make the outstanding list impossible to not look at,
 * which is the whole reason `bin/wiki-work` exists over there — and the reason
 * it exists is stated in that file: a list nobody has to open is a list that can
 * quietly stop being true.
 */
export function DocketRoute() {
  const [bench, setBench] = useState<BenchId>('collisions')
  const { data, error, loading } = useDocket()

  const current = BENCHES.find((b) => b.id === bench)!

  return (
    <div className="dk">
      <Nav />
      <SectionArt slug="docket" />
      <Marquee text={banner('docket')} duration={26} tone={4} size="clamp(0.72rem, 1.5vw, 1rem)" />

      <header className="wrap dk__mast">
        <h1 className="dk__title">
          <SubHead>THE DOCKET</SubHead>
        </h1>
        <span className="dk__kana jp" aria-hidden="true">
          未決
        </span>
        <p className="dk__note">
          Everything the record has not settled — and everything it has. A wiki that only publishes
          its conclusions is a brochure; this is the other file. Four benches: the claims that
          collide and have not been withdrawn, the gaps the pages write down about themselves, the
          bets left standing with what would kill them, and the dated blocks where a doubt actually
          got closed. Nothing here is summarised, ranked or scored — every item is the wiki's own
          prose, whole, with the page that wrote it.
        </p>

        {data && (
          <ul className="dk__scope">
            <li>
              <b>{data.counts.contradictions}</b> collisions held
            </li>
            <li>
              <b>{data.counts.gaps}</b> gaps open
            </li>
            <li>
              <b>{data.counts.predictionsStanding}</b> bets standing
            </li>
            <li>
              <b>{data.counts.rulings}</b> rulings recorded
            </li>
            <li>
              <b>{data.counts.pages}</b> of {data.counts.corpusPages} pages on the docket
            </li>
          </ul>
        )}
      </header>

      <div className="wrap dk__benches" role="tablist" aria-label="Benches">
        {BENCHES.map((b) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            id={`bench-${b.id}`}
            aria-selected={bench === b.id}
            aria-controls={`bench-panel-${b.id}`}
            className={`dk__bench${bench === b.id ? ' dk__bench--on' : ''}`}
            onClick={() => setBench(b.id)}
          >
            <span className="dk__bench-no">{b.numeral}</span>
            <span className="dk__bench-name">{b.title}</span>
            <span className="jp dk__bench-kana" aria-hidden="true">
              {b.kana}
            </span>
            <span className="dk__bench-n">{count(data, b.id)}</span>
          </button>
        ))}
      </div>

      <div
        className="wrap dk__stage"
        role="tabpanel"
        id={`bench-panel-${bench}`}
        aria-labelledby={`bench-${bench}`}
      >
        <p className="dk__blurb">{current.blurb}</p>

        {loading && <p className="dk__state">READING THE DOCKET…</p>}
        {error && (
          <p className="dk__state">
            The dataset is missing ({error}). Run <code>npm run docket</code> and rebuild.
          </p>
        )}
        {data && (
          <>
            {bench === 'collisions' && <Collisions set={data} />}
            {bench === 'field' && <Field set={data} />}
            {bench === 'board' && <Board set={data} />}
            {bench === 'rulings' && <Rulings set={data} />}
          </>
        )}

        <p className="dk__method">
          <b>METHOD</b> {current.method}
        </p>
      </div>

      <section className="wrap dk__foot">
        <h2 className="dk__foot-title">WHY THIS ROOM EXISTS</h2>
        <div className="dk__foot-body">
          <p>
            The second brain behind <Link to="/brain">THE WIKI-BRAIN</Link> is built on one rule it
            applies to itself: a finding states its own strongest counter-evidence, and a premise
            that moves is never cleared by bumping a date. Both rules produce paperwork — a
            contradiction nobody is allowed to quietly resolve, a gap nobody is allowed to quietly
            delete, a re-check nobody is allowed to skip — and that paperwork was, until this room,
            visible only to somebody standing in the repository with a terminal open.
          </p>
          <p>
            It is published here for the same reason it is written there. A body of work that shows
            you only its conclusions is asking to be taken on trust, and the parts of this one that
            are worth anything are the parts that can be checked. Every item on these four benches
            names the page it came from; every page is one click away, in full.
          </p>
          {data && (
            <p className="dk__foot-fine">
              Built from the snapshot at{' '}
              <time dateTime={data.generatedAt}>{data.generatedAt.slice(0, 10)}</time> over{' '}
              {data.counts.corpusPages} pages. Sealed pages are not read. The three on-site mirrors
              of the repository's own OPEN, DIGEST and RECENT files are skipped, because they list
              the same items this room is built from and reading them would count every gap twice.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

function count(data: ReturnType<typeof useDocket>['data'], id: BenchId) {
  if (!data) return ''
  if (id === 'collisions') return data.counts.contradictions
  if (id === 'field') return data.counts.gaps
  if (id === 'board') return data.counts.predictions
  return data.counts.rulings
}
