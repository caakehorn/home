import { Marquee } from '../components/Marquee'
import { Nav } from '../components/Nav'
import { PortalCard } from '../components/PortalCard'
import { Rig } from '../components/Rig'
import { SubHead, Wordmark } from '../components/Wordmark'
import { ChaosDial } from '../components/rigs/ChaosDial'
import { Oracle } from '../components/rigs/Oracle'
import { ScryPool } from '../components/rigs/ScryPool'
import { StickerSlab } from '../components/rigs/StickerSlab'
import { Terminal } from '../components/rigs/Terminal'
import { VibeSwitch } from '../components/rigs/VibeSwitch'
import { SECTIONS } from '../content/sections'
import { usePortal } from '../state/usePortal'
import './home.css'

const MISSION =
  'THE MORE EXCESS · THE BUSIER · THE MORE CHAOTIC · THE BRIGHTER · THE MORE NEON · THE MORE OBNOXIOUS · THE MORE VAPORWAVE · THE BETTER'

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
            EST. 4AM · ROOFTOP · ALWAYS OPEN
            <span className="jp"> 営業中</span>
          </span>

          <Wordmark
            text="DAN FRANK"
            kana="ダン・フランク"
            size="clamp(2.2rem, 8.5vw, 7rem)"
            className="mast__mark"
          />

          <h1 className="mast__head">
            <SubHead>MOONLIGHT INN</SubHead>
          </h1>

          <p className="mast__mission firetext">{MISSION}</p>

          <p className="mast__body">
            One building for the whole mess: the <b>wiki-brain</b> and everything it can be
            turned into, the <b>LEVIATHAN</b> visualizers dragged out and rebuilt louder,
            <b> experimental games</b> that mostly work, and the <b>transmissions</b> in between.
            Nothing here is tasteful. That is the specification.
          </p>

          <div className="mast__meta">
            <span className="mast__chip">{SECTIONS.length} WINGS</span>
            <span className="mast__chip">{rigs.length} LIVE RIGS</span>
            <span className="mast__chip">4 PALETTES</span>
            <span className="mast__chip mast__chip--hot">CHAOS ENABLED</span>
          </div>
        </div>
      </header>

      <Marquee text={MISSION} duration={34} tone={2} size="clamp(0.8rem, 1.8vw, 1.3rem)" />

      {/* ---- the wings ----------------------------------------------- */}
      <section className="wrap section" aria-labelledby="wings-title">
        <div className="section__head">
          <h2 id="wings-title" className="section__title">
            <SubHead venn={false}>THE WINGS</SubHead>
          </h2>
          <span className="section__kana jp" aria-hidden="true">
            館内
          </span>
          <p className="section__note">
            Four rooms. Two are being wired right now — the doors still open, there is just
            scaffolding inside.
          </p>
        </div>

        <div className="portals">
          {SECTIONS.map((section, i) => (
            <PortalCard key={section.slug} section={section} index={i} />
          ))}
        </div>
      </section>

      <Marquee
        text="SALVAGE · REBUILD · OVERCLOCK · SHIP UGLY · REPEAT ·"
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
        <Marquee text={MISSION} duration={28} tone={1} size="clamp(0.7rem, 1.5vw, 1rem)" />
        <div className="wrap foot__inner">
          <Wordmark text="DAN FRANK" size="clamp(1.4rem, 4vw, 2.6rem)" sparks={false} />
          <p className="foot__note">
            月光宿 MOONLIGHT INN · a portal under construction, permanently ·
            built loud, on purpose
          </p>
          <p className="foot__meta">
            <span>NO COOKIES</span>
            <span>NO ANALYTICS</span>
            <span>NO TASTE</span>
          </p>
        </div>
      </footer>
    </div>
  )
}
