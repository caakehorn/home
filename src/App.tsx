import { Route, Routes, useLocation } from 'react-router-dom'
import { Crawl } from './components/Crawl'
import { CrownDefs } from './components/Crown'
import { CursorTrail } from './components/CursorTrail'
import { JET_FUEL, RATIO } from './content/crawls'
import { Fx } from './components/Fx'
import { Hud } from './components/Hud'
import { Gate } from './gate/Gate'
import { ArcadeRoute } from './routes/Arcade'
import { BlogRoute } from './routes/Blog'
import { BlogPostRoute } from './routes/BlogPost'
import { GalleryRoute } from './routes/Gallery'
import { WritingDashboardRoute } from './routes/WritingDashboard'
import { Home } from './routes/Home'
import { LeviathanRoute } from './routes/Leviathan'
import { LineageRoute } from './routes/Lineage'
import { SageRoute } from './routes/Sage'
import { Splash } from './routes/Splash'
import { TermsRoute } from './routes/Terms'
import { TranscriptRoute } from './routes/Transcript'
import { WikiIndexRoute } from './routes/Wiki'
import { WikiPageRoute } from './routes/WikiPage'
import { Stub } from './routes/Stub'
import { usePortal } from './state/usePortal'

export function App() {
  const { pathname } = useLocation()

  // The terms are the one thing in front of the gate rather than behind it.
  // Everything else — every wing, every page, the screen effects, the HUD —
  // is inside it and does not mount until it opens.
  if (pathname === '/terms') return <TermsRoute />

  return (
    <Gate>
      <Site />
    </Gate>
  )
}

function Site() {
  const { entered } = usePortal()
  const { pathname } = useLocation()

  // The splash is the site's own front door, behind the gate: it stands in
  // front of Home only, and only once a session.
  const splashed = pathname === '/' && !entered

  return (
    <>
      <CrownDefs />
      <Fx />
      <CursorTrail />

      <Routes>
        <Route path="/" element={<Home />} />
        {/* static segments outrank the dynamic stub route */}
        <Route path="/lineage" element={<LineageRoute />} />
        <Route path="/arcade" element={<ArcadeRoute />} />
        <Route path="/arcade/:cab" element={<ArcadeRoute />} />
        <Route path="/blog" element={<BlogRoute />} />
        <Route path="/blog/write" element={<WritingDashboardRoute />} />
        <Route path="/blog/:slug" element={<BlogPostRoute />} />
        <Route path="/brain" element={<WikiIndexRoute />} />
        <Route path="/brain/*" element={<WikiPageRoute />} />
        <Route path="/gallery" element={<GalleryRoute />} />
        <Route path="/gallery/:id" element={<GalleryRoute />} />
        <Route path="/leviathan" element={<LeviathanRoute />} />
        <Route path="/leviathan/:id" element={<LeviathanRoute />} />
        <Route path="/sage" element={<SageRoute />} />
        <Route path="/transcript" element={<TranscriptRoute />} />
        <Route path="/:slug" element={<Stub />} />
      </Routes>

      {splashed && <Splash />}
      {/* Two crawls, same physics, mirrored: the ratio runs left along the
          top, the agenda runs right along the bottom. */}
      <Crawl nodes={RATIO} label="The ratio" edge="top" travel="left" />
      <Crawl nodes={JET_FUEL} label="Jet fuel" edge="bottom" travel="right" />
      <Hud />
    </>
  )
}
