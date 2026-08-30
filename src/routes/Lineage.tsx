import { useState } from 'react'
import { Marquee } from '../components/Marquee'
import { Nav } from '../components/Nav'
import { banner } from '../content/slogans'
import { SubHead } from '../components/Wordmark'
import { SectionArt } from '../components/SectionArt'
import { Dossier } from '../lineage/Dossier'
import { Lattice } from '../lineage/Lattice'
import {
  CORRIDORS,
  CROSSCHECK,
  HAPLOGROUPS,
  LINES,
  NOTE_ON_THE_VOID,
  SCOPE,
  SURNAMES,
  type LineId,
} from '../lineage/data'
import { MARKS } from '../wiki/palette'
import './lineage.css'

const ALL_LINES: LineId[] = ['frank', 'gillingham', 'shrum', 'thomas']

export function LineageRoute() {
  const [selected, setSelected] = useState<string | null>(null)
  const [activeLines, setActiveLines] = useState<Set<LineId>>(new Set(ALL_LINES))
  const [showCollateral, setShowCollateral] = useState(false)
  const [depth, setDepth] = useState(6)

  const toggleLine = (id: LineId) => {
    setActiveLines((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next.size ? next : new Set(ALL_LINES)
    })
  }

  return (
    <div className="lin">
      <Nav />
      <Marquee
        text={banner('lattice')}
        duration={24}
        tone={1}
        size="clamp(0.72rem, 1.5vw, 1rem)"
      />

      <header className="wrap lin__mast">
        <h1 className="lin__title">
          <SubHead>THE LATTICE</SubHead>
        </h1>
        <span className="lin__kana jp" aria-hidden="true">
          血統
        </span>
        <p className="lin__note">
          A pedigree drawn on a real time axis. Vertical position is the year someone was born,
          not their generation number — so the gaps are true, and the century where the paper
          record thins out is something you can see. Ring thickness is the share of Dan's genome
          that arrived through that person, halving every step back.
        </p>
        <ul className="lin__scope">
          <li><b>{SCOPE.individuals}</b> individuals</li>
          <li><b>{SCOPE.families}</b> families</li>
          <li><b>{SCOPE.directAncestors}</b> direct ancestors</li>
          <li><b>{SCOPE.europeanBorn}</b> European-born</li>
          <li><b>{SCOPE.generations}</b> generations</li>
        </ul>
      </header>

      <SectionArt slug="lineage" tone={4} />

      {/* ---- controls ---------------------------------------------------- */}
      <div className="wrap lin__controls">
        <div className="lin__lines" role="group" aria-label="Ancestral lines">
          {LINES.filter((l) => l.id !== 'core').map((line) => (
            <button
              key={line.id}
              type="button"
              className={`lin__line${activeLines.has(line.id) ? ' lin__line--on' : ''}`}
              aria-pressed={activeLines.has(line.id)}
              onClick={() => toggleLine(line.id)}
              title={line.blurb}
            >
              <span className="jp" aria-hidden="true">{line.kana}</span>
              {line.label}
            </button>
          ))}
        </div>

        <label className="lin__depth">
          <span>DEPTH</span>
          <input
            type="range"
            min={1}
            max={6}
            step={1}
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            aria-label="Generations shown"
          />
          <b>{depth} gen</b>
        </label>

        <label className="lin__toggle">
          <input
            type="checkbox"
            checked={showCollateral}
            onChange={(e) => setShowCollateral(e.target.checked)}
          />
          SHOW COLLATERALS <em>(0% DNA)</em>
        </label>
      </div>

      {/* ---- the lattice + dossier ---------------------------------------- */}
      <div className="wrap lin__stage">
        <Lattice
          selected={selected}
          onSelect={setSelected}
          activeLines={activeLines}
          showCollateral={showCollateral}
          depth={depth}
        />
        <Dossier id={selected} onSelect={setSelected} />
      </div>

      {/* ---- the void ------------------------------------------------------ */}
      <section className="wrap lin__void" aria-labelledby="void-title">
        <h2 id="void-title" className="lin__void-title">
          THE HOLE IN THE RECORD
        </h2>
        <div className="lin__void-body">
          <p>
            One ancestor is a surname and a country. <b>Harris</b>, born in Czechoslovakia, father
            of Sadie — no given name, no birth date, no immigration record, no residence history.
            He is Dan's great-great-grandfather and roughly <b>6.25%</b> of his genome, and the
            GEDCOM holds a single datum about him.
          </p>
          <p className="lin__void-fine">{NOTE_ON_THE_VOID}</p>
          <button type="button" className="lin__void-btn" onClick={() => setSelected('harris-unknown')}>
            FIND HIM ON THE LATTICE →
          </button>
        </div>
      </section>

      {/* ---- paper vs DNA --------------------------------------------------- */}
      <section className="wrap lin__section" aria-labelledby="check-title">
        <h2 id="check-title" className="lin__h2">
          <SubHead venn={false}>PAPER vs BLOOD</SubHead>
        </h2>
        <p className="lin__lede">
          The GEDCOM and the 23andMe report are independent witnesses. Where they agree, the tree
          is corroborated; where they diverge, the paper is the thing to doubt.
        </p>

        <ul className="lin__legend">
          <li><span className="lin__sw" style={{ background: MARKS[0] }} aria-hidden="true" />documentary expectation</li>
          <li><span className="lin__sw" style={{ background: MARKS[1] }} aria-hidden="true" />23andMe result</li>
        </ul>

        <table className="lin__check">
          <thead>
            <tr>
              <th scope="col">Component</th>
              <th scope="col">Expected</th>
              <th scope="col">Measured</th>
              <th scope="col">Reading</th>
            </tr>
          </thead>
          <tbody>
            {CROSSCHECK.map((row) => (
              <tr key={row.label}>
                <th scope="row">
                  {row.label}
                  <em>{row.expect}</em>
                </th>
                <td className="lin__num">{row.paper === null ? '—' : `${row.paper}%`}</td>
                <td className="lin__num">{row.dna}%</td>
                <td>
                  <span className="lin__bars" aria-hidden="true">
                    {row.paper !== null && (
                      <span className="lin__bar" style={{ width: `${row.paper}%`, background: MARKS[0] }} />
                    )}
                    <span className="lin__bar" style={{ width: `${row.dna}%`, background: MARKS[1] }} />
                  </span>
                  <span className="lin__verdict">{row.verdict}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="lin__haplo">
          {HAPLOGROUPS.map((h) => (
            <div key={h.code} className="lin__haplo-card">
              <span className="lin__haplo-code">{h.code}</span>
              <b>{h.line}</b>
              <p>{h.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- corridors ------------------------------------------------------ */}
      <section className="wrap lin__section" aria-labelledby="corr-title">
        <h2 id="corr-title" className="lin__h2">
          <SubHead venn={false}>CORRIDORS</SubHead>
        </h2>
        <p className="lin__lede">
          Six documented routes into Fayette County. Every one of them ends within about forty
          miles of where Dan was born.
        </p>
        <ol className="lin__corridors">
          {CORRIDORS.map((c) => (
            <li key={c.id} className="lin__corridor">
              <span className="lin__corridor-from">{c.from}</span>
              {c.hops.map((hop) => (
                <span key={hop} className="lin__hop">
                  <span className="lin__arrow" aria-hidden="true" />
                  {hop}
                </span>
              ))}
              <span className="lin__corridor-who">{c.who}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- surname mass --------------------------------------------------- */}
      <section className="wrap lin__section" aria-labelledby="sur-title">
        <h2 id="sur-title" className="lin__h2">
          <SubHead venn={false}>SURNAME MASS</SubHead>
        </h2>
        <p className="lin__lede">
          How the 515 individuals distribute by name. The long tail after Shrum is collateral —
          cousins, siblings and spouses who married inside the same two counties for a century.
        </p>
        <ul className="lin__surnames">
          {SURNAMES.map((s) => (
            <li key={s.name}>
              <span className="lin__sur-name">{s.name}</span>
              <span className="lin__sur-bar" style={{ width: `${(s.count / SURNAMES[0].count) * 100}%` }} />
              <span className="lin__sur-count">{s.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="wrap lin__foot">
        Transcribed from <code>wiki/self/lineage/family-tree.md</code> and{' '}
        <code>wiki/self/lineage/23andme-genomics.md</code>. Autosomal shares are computed from
        generation depth, not copied.
      </footer>
    </div>
  )
}
