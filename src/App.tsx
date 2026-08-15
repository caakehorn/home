import { Route, Routes, useLocation } from 'react-router-dom'
import { CursorTrail } from './components/CursorTrail'
import { Fx } from './components/Fx'
import { Hud } from './components/Hud'
import { Home } from './routes/Home'
import { Splash } from './routes/Splash'
import { WikiIndexRoute } from './routes/Wiki'
import { WikiPageRoute } from './routes/WikiPage'
import { Stub } from './routes/Stub'
import { usePortal } from './state/usePortal'

export function App() {
  const { entered } = usePortal()
  const { pathname } = useLocation()

  // The gate only stands in front of the front door, and only once a session.
  const gated = pathname === '/' && !entered

  return (
    <>
      <Fx />
      <CursorTrail />

      <Routes>
        <Route path="/" element={<Home />} />
        {/* static segments outrank the dynamic stub route */}
        <Route path="/brain" element={<WikiIndexRoute />} />
        <Route path="/brain/*" element={<WikiPageRoute />} />
        <Route path="/:slug" element={<Stub />} />
      </Routes>

      {gated && <Splash />}
      <Hud />
    </>
  )
}
