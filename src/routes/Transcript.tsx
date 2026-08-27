import { Marquee } from '../components/Marquee'
import { Nav } from '../components/Nav'
import { SectionArt } from '../components/SectionArt'
import { SubHead } from '../components/Wordmark'
import { sectionBySlug } from '../content/sections'
import { Record } from '../transcript/Record'
import './transcript.css'

const section = sectionBySlug('transcript')!

/**
 * THE TRANSCRIPT — the wing.
 *
 * The complete message record, carried over whole from the old repo. Every
 * other room in this building is a reading of something: the wiki is prose
 * about the record, LEVIATHAN counts it, the lattice draws the family it
 * happened in. This one is the thing itself, and it is deliberately the least
 * designed room here — the only job the chrome has is to get out of the way of
 * 134,348 lines somebody actually typed.
 */
export function TranscriptRoute() {
  return (
    <div className="tsw" style={{ ['--glow' as string]: `var(--n${section.accent})` }}>
      <Nav />
      <SectionArt slug="transcript" />
      <Marquee
        text={section.chant}
        duration={20}
        tone={section.accent}
        size="clamp(0.75rem, 1.6vw, 1.05rem)"
      />

      <header className="wrap tsw__masthead">
        <h1 className="tsw__title">
          <SubHead>THE TRANSCRIPT</SubHead>
        </h1>
        <span className="tsw__kana jp" aria-hidden="true">
          {section.kana}
        </span>
        <p className="tsw__note">{section.blurb}</p>
        <p className="tsw__rule">
          <b>THE RULE</b> — the same one the instruments run on, and it binds harder here. Nothing
          on this page is a reading of the record. There is no summary, no sentiment, no selection,
          no highlights, no order but the order it was sent in. The only things this room adds to
          the text are a line number, a timestamp already in the export, and whatever filter the
          reader asked for. Everything else on the site is an argument about this material;{' '}
          <i>this</i> is the material.
        </p>
      </header>

      <main className="wrap">
        <Record />
      </main>
    </div>
  )
}
