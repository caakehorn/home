import { Kiss } from '../components/Kiss'
import { Marquee } from '../components/Marquee'
import { Nav } from '../components/Nav'
import { PortalCard } from '../components/PortalCard'
import { Rig } from '../components/Rig'
import { Logo } from '../components/Logo'
import { SubHead } from '../components/Wordmark'
import { ChaosDial } from '../components/rigs/ChaosDial'
import { Terminal } from '../components/rigs/Terminal'
import { VibeSwitch } from '../components/rigs/VibeSwitch'
import { SECTIONS } from '../content/sections'
import { banner } from '../content/slogans'
import { VIBES } from '../state/portal-context'
import { usePortal } from '../state/usePortal'
import './home.css'

const MISSION = banner('mast')
const DARK = SECTIONS.filter((section) => section.status !== 'LIVE').length

export function Home() {
  const { rigs } = usePortal()

  return (
    <div className="home">
      <Nav />

      {/* ---- masthead ------------------------------------------------ */}
      <header className="mast">
        <div className="mast__glow" aria-hidden="true" />
        <div className="wrap mast__inner">
          <span className="eyebrow mast__eyebrow">
            OPEN LATE · ARGUE FIRST · CITE AFTERWARDS · ASK NOBODY
            <span className="jp"> 営業中</span>
          </span>

          <Logo size="clamp(1.6rem, 5.6vw, 4.2rem)" className="mast__mark" />

          <h1 className="mast__head">
            <SubHead crown>DIALECTICAL DATABASE &amp; DRUG DEN</SubHead>
          </h1>

          <p className="mast__mission firetext">{MISSION}</p>

          <p className="mast__body">
            Three things under one roof, and they are the same thing. The <b>dialectic</b>: every
            position here got argued at, usually by me, usually at an hour no argument should be
            trusted at. The <b>database</b>: it all got written down anyway — 458 pages, cited,
            cross-linked, contradictions left in where they are load-bearing. The <b>den</b>: the
            room where both of those happened, which was never as well-ventilated as it should
            have been. Nothing here is tasteful. That is the specification, not an apology — and
            the tasteful web is a uniform nobody issued you.
          </p>

          <div className="mast__meta">
            <span className="mast__chip">{SECTIONS.length} ROOMS</span>
            <span className="mast__chip">{rigs.length} LIVE RIGS</span>
            <span className="mast__chip">{VIBES.length} PALETTES</span>
            <span className="mast__chip mast__chip--hot">CHAOS ENABLED</span>
          </div>
        </div>
      </header>

      <Marquee text={MISSION} duration={34} tone={2} size="clamp(0.8rem, 1.8vw, 1.3rem)" />

      {/* ---- the rooms ------------------------------------------------ */}
      <section className="wrap section" aria-labelledby="rooms-title">
        <div className="section__head">
          <h2 id="rooms-title" className="section__title">
            <SubHead venn={false}>THE ROOMS</SubHead>
          </h2>
          <span className="section__kana jp" aria-hidden="true">
            館内
          </span>
          <p className="section__note">
            {SECTIONS.length} rooms off one hallway.{' '}
            {DARK === 0
              ? 'All of them are open, which has never been true before and will not stay true.'
              : `${DARK === 1 ? 'One is' : `${DARK} are`} still being wired — the door opens, there is just scaffolding and a smell in there.`}
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
        duration={22}
        reverse
        tone={3}
        size="clamp(0.75rem, 1.6vw, 1.1rem)"
        lean={-0.6}
      />

      {/* ---- the void ------------------------------------------------- */}
      <section className="void-band" aria-labelledby="void-title">
        <div className="void-band__wash" aria-hidden="true" />
        <div className="wrap void-band__inner">
          <Kiss className="void-band__art" label="Two people in profile, kissing, lit from behind" />

          <div className="void-band__say">
            <span className="void-band__kana jp" aria-hidden="true">
              虚空
            </span>
            <h2 id="void-title" className="void-band__title">
              <SubHead venn={false}>ENTER THE VOID</SubHead>
            </h2>
            <p className="void-band__note">
              Everything else in this building is one man arguing with a record at an hour the
              record should not be trusted at. This is the other thing. It is two people under a
              light on a street that does not care, at the end of a night that went on too long,
              and it is the only part of the whole operation that was never a citation.
            </p>
            <p className="void-band__meta">
              <span>NO PERMISSION ASKED</span>
              <span>NO APOLOGY OFFERED</span>
              {/* not 4am. 4:11:43 AM, which is a timestamp in a payments ledger. */}
              <span>4:11 AM</span>
            </p>
          </div>
        </div>
      </section>

      {/* ---- the console --------------------------------------------- */}
      <section className="wrap section" aria-labelledby="console-title">
        <div className="section__head">
          <h2 id="console-title" className="section__title">
            <SubHead>THE CONSOLE</SubHead>
          </h2>
          <span className="section__kana jp" aria-hidden="true">
            操作卓
          </span>
          <p className="section__note">
            Three things you can actually grab. They are wired to each other and to the rest of
            the building — the dial and the palette drive every page you visit after this one,
            and the shell knows more verbs than it admits to.
          </p>
        </div>

        <div className="console">
          <Rig index={1} title="CHAOS DIAL" kana="混沌" hint="0 to 11 · drives the whole site" accent={2}>
            <ChaosDial />
          </Rig>

          <Rig index={2} title="VIBE SWITCH" kana="色替" hint="five palettes · toner, neon" accent={1}>
            <VibeSwitch />
          </Rig>

          <Rig index={3} title="SHELL" kana="端末" hint="type at it · it answers · it navigates" accent={3} wide>
            <Terminal />
          </Rig>
        </div>
      </section>

      {/* ---- footer --------------------------------------------------- */}
      <footer className="foot">
        <Marquee text={banner('foot')} duration={28} tone={1} size="clamp(0.7rem, 1.5vw, 1rem)" />
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
