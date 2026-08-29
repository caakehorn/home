import { Suspense, lazy } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Crawl } from './components/Crawl'
import { CrownDefs } from './components/Crown'
import { JET_FUEL, RATIO } from './content/crawls'
import { Fx } from './components/Fx'
import { Hud } from './components/Hud'
import { Gate } from './gate/Gate'
import { Home } from './routes/Home'
import { Splash } from './routes/Splash'
import { TermsRoute } from './routes/Terms'
import { WikiIndexRoute } from './routes/Wiki'
import { WikiPageRoute } from './routes/WikiPage'
import { Stub } from './routes/Stub'
import { usePortal } from './state/usePortal'

/* ==========================================================================
   WHAT LOADS WHEN

   Everything used to be in one bundle: 729 kB of JavaScript, of which the
   front door and the home page use maybe a third. The rest is four arcade
   cabinets with their own game loops, thirty leviathan instruments, a
   134,348-row transcript reader, a lightbox gallery and a markdown editor —
   none of which anybody has asked for at the moment they are looking at the
   splash, and all of which they were downloading and parsing before the door
   would open.

   The eager set is the critical path and nothing else: the door, the home
   page, and the wiki — index and page — because the wiki is what this
   building is for and a deployment portal that code-splits its own payload is
   a deployment portal that stutters on the one navigation everybody makes.
   Terms is eager because it renders in front of the gate.

   Everything else is fetched when somebody actually goes there. On a fast
   connection the chunk arrives inside the nav transition and nothing is ever
   seen; on a slow one there is a fallback below that says which room is
   arriving.
   ========================================================================== */

const ArcadeRoute = lazy(() => import('./routes/Arcade').then((m) => ({ default: m.ArcadeRoute })))
const BlogRoute = lazy(() => import('./routes/Blog').then((m) => ({ default: m.BlogRoute })))
const BlogPostRoute = lazy(() =>
  import('./routes/BlogPost').then((m) => ({ default: m.BlogPostRoute })),
)
const DocketRoute = lazy(() => import('./routes/Docket').then((m) => ({ default: m.DocketRoute })))
const GalleryRoute = lazy(() =>
  import('./routes/Gallery').then((m) => ({ default: m.GalleryRoute })),
)
const WritingDashboardRoute = lazy(() =>
  import('./routes/WritingDashboard').then((m) => ({ default: m.WritingDashboardRoute })),
)
const LeviathanRoute = lazy(() =>
  import('./routes/Leviathan').then((m) => ({ default: m.LeviathanRoute })),
)
const LineageRoute = lazy(() =>
  import('./routes/Lineage').then((m) => ({ default: m.LineageRoute })),
)
const SageRoute = lazy(() => import('./routes/Sage').then((m) => ({ default: m.SageRoute })))
const WordsRoute = lazy(() => import('./routes/Words').then((m) => ({ default: m.WordsRoute })))
const TranscriptRoute = lazy(() =>
  import('./routes/Transcript').then((m) => ({ default: m.TranscriptRoute })),
)

/** What a room looks like on the way in, on a connection slow enough to see. */
function Arriving() {
  return (
    <p className="wrap arriving">
      <span className="jp" aria-hidden="true">
        起動中
      </span>
      OPENING THE ROOM…
    </p>
  )
}

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

      <Suspense fallback={<Arriving />}>
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
          <Route path="/docket" element={<DocketRoute />} />
          <Route path="/gallery" element={<GalleryRoute />} />
          <Route path="/gallery/:id" element={<GalleryRoute />} />
          <Route path="/leviathan" element={<LeviathanRoute />} />
          <Route path="/leviathan/:id" element={<LeviathanRoute />} />
          <Route path="/sage" element={<SageRoute />} />
          <Route path="/words" element={<WordsRoute />} />
          <Route path="/transcript" element={<TranscriptRoute />} />
          <Route path="/:slug" element={<Stub />} />
        </Routes>
      </Suspense>

      {splashed && <Splash />}
      {/* Two crawls, same physics, mirrored: the ratio runs left along the
          top, the agenda runs right along the bottom. */}
      <Crawl nodes={RATIO} label="The ratio" edge="top" travel="left" />
      <Crawl nodes={JET_FUEL} label="Jet fuel" edge="bottom" travel="right" />
      <Hud />
    </>
  )
}
