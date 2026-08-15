import { Marquee } from '../components/Marquee'
import { Nav } from '../components/Nav'
import { PortalCard } from '../components/PortalCard'
import { Rig } from '../components/Rig'
import { Logo } from '../components/Logo'
import { SubHead } from '../components/Wordmark'
import { ChaosDial } from '../components/rigs/ChaosDial'
import { Oracle } from '../components/rigs/Oracle'
import { ScryPool } from '../components/rigs/ScryPool'
import { StickerSlab } from '../components/rigs/StickerSlab'
import { Terminal } from '../components/rigs/Terminal'
import { VibeSwitch } from '../components/rigs/VibeSwitch'
import { SECTIONS } from '../content/sections'
import { banner } from '../content/slogans'
import { usePortal } from '../state/usePortal'
import './home.css'

const MISSION = banner('mast')

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
            OPEN LATE · ARGUE FIRST · CITE AFTERWARDS
            <span className="jp"> 営業中</span>
          </span>

          <Logo size="clamp(1.6rem, 5.6vw, 4.2rem)" className="mast__mark" />

          <h1 className="mast__head">
            <SubHead>DIALECTICAL DATABASE &amp; DRUG DEN</SubHead>
          </h1>

          <p className="mast__mission firetext">{MISSION}</p>

          <p className="mast__body">
            Three things under one roof, and they are the same thing. The <b>dialectic</b>: every
            position here got argued at, usually by me, usually at an hour no argument should be
            trusted at. The <b>database</b>: it all got written down anyway — 458 pages, cited,
            cross-linked, contradictions left in where they are load-bearing. The <b>den</b>: the
            room where both of those happened, which was never as well-ventilated as it should
            have been. Nothing here is tasteful. That is the specification, not an apology.
          </p>

          <div className="mast__meta">
            <span className="mast__chip">{SECTIONS.length} ROOMS</span>
            <span className="mast__chip">{rigs.length} LIVE RIGS</span>
            <span className="mast__chip">4 PALETTES</span>
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
            {SECTIONS.filter((s) => s.status !== 'LIVE').length} are still being wired — the doors
            open, there is just scaffolding and a smell in there.
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
            Six things you can actually grab. They are wired to each other and to the rest of
            the building — the dial and the palette drive every page you visit after this one.
          </p>
        </div>

        <div className="console">
          <Rig index={1} title="CHAOS DIAL" kana="混沌" hint="0 to 11 · drives the whole site" accent={2}>
            <ChaosDial />
          </Rig>

          <Rig index={2} title="VIBE SWITCH" kana="色替" hint="four palettes, four references" accent={1}>
            <VibeSwitch />
          </Rig>

          <Rig index={3} title="SCRY POOL" kana="覗池" hint="LEVIATHAN offcut · pointer-driven field" accent={3} wide>
            <ScryPool />
          </Rig>

          <Rig index={4} title="SHELL" kana="端末" hint="type at it · it answers · it navigates" accent={5} wide>
            <Terminal />
          </Rig>

          <Rig index={5} title="THE ORACLE" kana="御神籤" hint="pull the lever · take the verdict" accent={4}>
            <Oracle />
          </Rig>

          <Rig index={6} title="STICKER SLAB" kana="貼札" hint="drag · fling · they bounce" accent={2}>
            <StickerSlab />
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
            built loud, on purpose
          </p>
          <p className="foot__meta">
            <span>NO COOKIES</span>
            <span>NO ANALYTICS</span>
            <span>NO TAPER</span>
          </p>
        </div>
      </footer>
    </div>
  )
}
