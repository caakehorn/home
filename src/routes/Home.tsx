import { Link } from 'react-router-dom'
import { Crown } from '../components/Crown'
import { Kiss } from '../components/Kiss'
import { Marquee } from '../components/Marquee'
import { Nav } from '../components/Nav'
import { PortalCard } from '../components/PortalCard'
import { Plate } from '../components/Plate'
import { Rig } from '../components/Rig'
import { Logo } from '../components/Logo'
import { SubHead } from '../components/Wordmark'
import { ChaosDial } from '../components/rigs/ChaosDial'
import { Terminal } from '../components/rigs/Terminal'
import { VibeSwitch } from '../components/rigs/VibeSwitch'
import { ALLY } from '../content/art'
import { hangs } from '../content/slates'
import { SECTIONS } from '../content/sections'
import { banner } from '../content/slogans'
import { VIBES } from '../state/portal-context'
import { usePortal } from '../state/usePortal'
import { BrainConsole } from '../wiki/Console'
import './home.css'

/* ==========================================================================
   THE MAIN FLOOR

   Reordered around what the building is for. It used to open with three
   paragraphs about the meaning of the word "dialectic" and put the wiki —
   the entire reason any of this exists — in slot one of an eight-card grid,
   below the fold, indistinguishable from the arcade.

   The order is now: the brain, the rooms, the rigs. The masthead is four
   lines and a crown instead of a lecture, because the thing a portal owes you
   in the first screen is a way in, not an argument.

   ---- the pictures --------------------------------------------------

   Six frames of animation hang around the building and five photographs of
   one person hang in a section of their own near the bottom of this page.

   Those five used to be the payload of the relics — ten stickers hidden
   across the front door and this page, each opening a panel with a line, a
   date and a door into the wiki. The hunt is gone. What it was hiding is not:
   it is a section now, at a size you can actually see, with the same writing
   under it. A hidden thing nobody finds is not a thing on the site, and five
   photographs of the only person who has read the whole wiki were the wrong
   thing to have made into a pixel hunt.
   ========================================================================== */

const MISSION = banner('mast')

export function Home() {
  const { rigs } = usePortal()

  return (
    <div className="home">
      <Nav />

      {/* ---- masthead ------------------------------------------------ */}
      <header className="mast">
        <div className="wrap mast__inner">
          <span className="eyebrow mast__eyebrow">
            OPEN LATE · ARGUE FIRST · CITE AFTERWARDS · ASK NOBODY
            <span className="jp"> 営業中</span>
          </span>

          <div className="mast__mark-row">
            <Logo size="clamp(1.6rem, 5.6vw, 4.2rem)" className="mast__mark" />
            <Crown className="mast__crown" />
          </div>

          <h1 className="mast__head">
            <SubHead crown>DIALECTICAL DATABASE &amp; DRUG DEN</SubHead>
          </h1>

          <p className="mast__mission firetext">{MISSION}</p>

          <p className="mast__body">
            A wiki about one person, written by him, argued at by him, and left contradictory where
            the contradictions are load-bearing. Everything else in this building — the core, the map,
            the lattice, the instruments, the arcade, the noise — is a different instrument pointed at
            the same corpus. <b>The brain is the point. Start there.</b>
          </p>

          {/* The knocked-out one, standing in the masthead with the heading
              wrapped around her. Her feet run off the bottom of the block and
              are cut by the rule that closes it — the mast already clips, and
              a figure that fits neatly inside her box reads as an
              illustration rather than as something stuck there. */}
          <Plate
            plate={hangs('mast')}
            cut="none"
            className="mast__plate"
            eager
          />

          <div className="mast__meta">
            <span className="mast__chip">{SECTIONS.length} ROOMS</span>
            <span className="mast__chip">{rigs.length} LIVE RIGS</span>
            <span className="mast__chip">{VIBES.length} PALETTES</span>
            <span className="mast__chip mast__chip--hot">CHAOS ENABLED</span>
          </div>
        </div>
      </header>

      {/* ---- the brain ------------------------------------------------- */}
      <BrainConsole />

      <Marquee text={MISSION} duration={30} tone={3} size="clamp(0.8rem, 1.8vw, 1.3rem)" />

      {/* ---- the rooms ------------------------------------------------- */}
      <section className="wrap section" aria-labelledby="rooms-title">
        <div className="section__head">
          <h2 id="rooms-title" className="section__title">
            <SubHead venn={false}>THE ROOMS</SubHead>
          </h2>
          <span className="section__kana jp" aria-hidden="true">
            館内
          </span>
          <p className="section__note">
            {SECTIONS.length} instruments pointed at the same corpus. The brain holds it; the core
            hangs the whole of it in one place and lets you fly through the argument; the lattice
            puts it on a time axis; the transcript is the raw material every other room argues
            about; the arcade is one room with one person's name on it, and she earned it.
          </p>
        </div>

        <div className="portals">
          {SECTIONS.map((section, i) => (
            <PortalCard key={section.slug} section={section} index={i} />
          ))}
        </div>
      </section>

      <Marquee
        text={banner('rooms')}
        duration={20}
        reverse
        tone={2}
        size="clamp(0.75rem, 1.6vw, 1.1rem)"
        lean={-0.6}
      />

      {/* ---- the two of them ------------------------------------------ */}
      <section className="void-band" aria-labelledby="void-title">
        <div className="void-band__wash" aria-hidden="true" />
        <div className="wrap void-band__inner">
          <div className="void-band__stack">
            <Plate
              plate={hangs('void-1')}
              cut="torn"
              className="void-band__plate void-band__plate--1"
            />
            <Plate
              plate={hangs('void-2')}
              cut="shard"
              className="void-band__plate void-band__plate--2"
            />
            <Plate
              plate={hangs('void-3')}
              cut="rip"
              className="void-band__plate void-band__plate--3"
            />
          </div>

          <div className="void-band__say">
            <span className="void-band__kana jp" aria-hidden="true">
              虚空
            </span>
            <h2 id="void-title" className="void-band__title">
              <SubHead venn={false}>ENTER THE VOID</SubHead>
            </h2>
            <p className="void-band__note">
              Every other room here is one man arguing with a record at an hour the record should
              not be trusted at. This is the other thing. Three frames and nobody's name on any of
              them — a window at nine in the morning, the middle of a lake in front of everybody,
              and one where both of them have their eyes shut. Nobody in particular, on purpose,
              because the whole point of a drawing is that it is anybody. None of it is evidence
              and none of it is being cited.
            </p>
            {/* The house's own drawing of this picture, kept. It used to be the
                only thing on this wall; it signs the copy now instead. */}
            <Kiss className="void-band__mark" label="Two people in profile, kissing, lit from behind" />

            <p className="void-band__meta">
              <span>NO PERMISSION ASKED</span>
              <span>NO APOLOGY OFFERED</span>
              <span>4:11 AM</span>
            </p>
          </div>
        </div>
      </section>

      {/* ---- the console --------------------------------------------- */}
      <section className="wrap section" aria-labelledby="console-title">
        <div className="section__head">
          <h2 id="console-title" className="section__title">
            <SubHead>THE RIGS</SubHead>
          </h2>
          <span className="section__kana jp" aria-hidden="true">
            操作卓
          </span>
          <p className="section__note">
            Three things you can actually grab. They are wired to each other and to the rest of the
            building — the dial and the palette drive every page you visit after this one, and the
            shell knows more verbs than it admits to.
          </p>
        </div>

        <div className="console">
          <Rig index={1} title="CHAOS DIAL" kana="混沌" hint="0 to 11 · drives the whole site" accent={1}>
            <ChaosDial />
          </Rig>

          <Rig index={2} title="VIBE SWITCH" kana="色替" hint="five palettes · void, dmt, paper" accent={3}>
            <VibeSwitch />
          </Rig>

          <Rig index={3} title="SHELL" kana="端末" hint="type at it · it answers · it navigates" accent={2} wide>
            <Terminal />
          </Rig>

        </div>
      </section>

      {/* ---- the photographs ------------------------------------------ */}
      <section className="wrap section ally" aria-labelledby="ally-title">
        <div className="section__head">
          <h2 id="ally-title" className="section__title">
            <SubHead venn={false}>ALLY LUBIN</SubHead>
          </h2>
          <span className="section__kana jp" aria-hidden="true">
            記録
          </span>
          <p className="section__note">
            Five photographs and five things that were actually said, on dates that are actually in
            the record. She is the only person who has read the whole wiki — four thousand words
            about herself, at 2 AM — and came back the next morning with notes and a question
            nobody else thought to ask: <b>“did it align with like your concept of who I am?”</b>
          </p>
        </div>

        <div className="ally__grid">
          {ALLY.map((photo, i) => (
            <article
              key={photo.id}
              className="ally__card"
              style={{
                ['--glow' as string]: `var(--n${photo.tone})`,
                ['--rot' as string]: `${i % 2 ? 1.4 : -1.6}deg`,
              }}
            >
              <Plate plate={photo} cut={i % 2 ? 'rip' : 'torn'} className="ally__plate" />
              <div className="ally__say">
                <span className="ally__stamp">{photo.stamp}</span>
                <h3 className="ally__title">{photo.title}</h3>
                <blockquote className="ally__quote">{photo.quote}</blockquote>
                <p className="ally__note">{photo.note}</p>
                <Link to={photo.href} className="ally__go">
                  {photo.hrefLabel} →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ---- footer --------------------------------------------------- */}
      <footer className="foot">
        <Marquee text={banner('foot')} duration={24} tone={1} size="clamp(0.7rem, 1.5vw, 1rem)" />
        <div className="wrap foot__inner">
          <Logo size="clamp(1.1rem, 3vw, 1.9rem)" />
          <p className="foot__note">
            弁証薬窟 · DAN'S DIALECTICAL DATABASE AND DRUG DEN · under construction, permanently ·
            built loud, on purpose · no permission asked
          </p>
          <p className="foot__meta">
            <span>NO COOKIES</span>
            <span>NO ANALYTICS</span>
            <span>NO TRACKING</span>
            <span>NO ADS</span>
            <span>NO TAPER</span>
          </p>
        </div>
      </footer>
    </div>
  )
}
