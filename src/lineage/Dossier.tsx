import { Link } from 'react-router-dom'
import {
  CORRIDORS,
  NOTE_ON_THE_VOID,
  PEOPLE,
  descentPath,
  dnaShare,
  fractionLabel,
  shareLabel,
  LINES,
} from './data'
import './dossier.css'

/** The panel for one ancestor. Everything in it is computed or transcribed. */
export function Dossier({ id, onSelect }: { id: string | null; onSelect: (id: string | null) => void }) {
  const person = PEOPLE.find((p) => p.id === id)

  if (!person) {
    return (
      <aside className="dos dos__empty">
        <span className="dos__eyebrow">DOSSIER</span>
        <p>
          Pick anyone on the lattice. The ring around each node is the share of Dan's genome that
          came through them — halving every generation, which is why the deep ancestors are nearly
          all ring and no fill.
        </p>
      </aside>
    )
  }

  const share = dnaShare(person)
  const chain = descentPath(person.id)
    .map((step) => PEOPLE.find((p) => p.id === step))
    .filter((p): p is (typeof PEOPLE)[number] => Boolean(p))
  const line = LINES.find((l) => l.id === person.line)!
  const corridor = CORRIDORS.find((c) => c.from === person.crossed)
  const isVoid = person.documented === false

  return (
    <aside className={`dos${isVoid ? ' dos--void' : ''}`} aria-live="polite">
      <header className="dos__head">
        <span className="dos__eyebrow">
          {person.role ?? `${person.gen} generations back`} · {line.label}
        </span>
        <h3 className="dos__name">{person.name}</h3>
        {person.bornLabel && (
          <p className="dos__dates">
            {person.bornLabel}
            {person.diedLabel ? ` — ${person.diedLabel}` : ''}
          </p>
        )}
      </header>

      {/* the share */}
      <div className="dos__share">
        {share === null ? (
          <>
            <span className="dos__share-num">0</span>
            <span className="dos__share-note">
              {person.gen === 0 ? 'sibling — not an ancestor' : 'collateral kin — contributes no autosomal DNA'}
            </span>
          </>
        ) : (
          <>
            <span className="dos__share-num">{shareLabel(share)}</span>
            <span className="dos__share-frac">{fractionLabel(share)}</span>
            <span className="dos__share-note">of Dan's autosomal DNA, by generation depth</span>
          </>
        )}
      </div>

      <dl className="dos__facts">
        {person.birthPlace && (
          <>
            <dt>Born</dt>
            <dd>{person.birthPlace}</dd>
          </>
        )}
        {person.deathPlace && (
          <>
            <dt>Died</dt>
            <dd>{person.deathPlace}</dd>
          </>
        )}
        <dt>Line</dt>
        <dd>{line.blurb}</dd>
        {person.crossed && (
          <>
            <dt>Crossed</dt>
            <dd>
              {person.crossed}
              {corridor && ` → ${corridor.hops.join(' → ')}`}
            </dd>
          </>
        )}
      </dl>

      {/* descent chain, walkable */}
      {chain.length > 1 && (
        <div className="dos__chain">
          <span className="dos__eyebrow">DESCENT</span>
          <ol>
            {chain.map((step, i) => (
              <li key={step.id}>
                <button
                  type="button"
                  className={`dos__step${step.id === person.id ? ' dos__step--on' : ''}`}
                  onClick={() => onSelect(step.id)}
                >
                  {step.name.replace(/"[^"]*"\s*/g, '')}
                </button>
                {i < chain.length - 1 && <span aria-hidden="true"> ↓ </span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {person.note && <p className="dos__note">{person.note}</p>}

      {isVoid && (
        <p className="dos__correction">
          <b>On the figure:</b> {NOTE_ON_THE_VOID}
        </p>
      )}

      {person.wiki && (
        <Link to={`/brain/${person.wiki}`} className="dos__link">
          OPEN WIKI PAGE →
        </Link>
      )}
    </aside>
  )
}
