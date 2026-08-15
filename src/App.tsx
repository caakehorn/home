import { Route, Routes, useLocation } from 'react-router-dom'
import { CursorTrail } from './components/CursorTrail'
import { Fx } from './components/Fx'
import { Hud } from './components/Hud'
import { Gate } from './gate/Gate'
import { Home } from './routes/Home'
import { LeviathanRoute } from './routes/Leviathan'
import { LineageRoute } from './routes/Lineage'
import { Splash } from './routes/Splash'
import { TermsRoute } from './routes/Terms'
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
      <Fx />
      <CursorTrail />

      <Routes>
        <Route path="/" element={<Home />} />
        {/* static segments outrank the dynamic stub route */}
        <Route path="/lineage" element={<LineageRoute />} />
        <Route path="/brain" element={<WikiIndexRoute />} />
        <Route path="/brain/*" element={<WikiPageRoute />} />
        <Route path="/leviathan" element={<LeviathanRoute />} />
        <Route path="/leviathan/:id" element={<LeviathanRoute />} />
        <Route path="/:slug" element={<Stub />} />
      </Routes>

      {splashed && <Splash />}
      <Hud />
    </>
  )
}
