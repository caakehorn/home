import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { Boundary, isStaleChunk, reloadOnce } from './components/Boundary'
import { PortalProvider } from './state/PortalProvider'
import './styles/global.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root is missing from index.html')

/**
 * A deploy landing under an open tab, caught before React ever sees it.
 *
 * Vite fires `vite:preloadError` when the module preload for a lazy chunk
 * fails, which on this site means one thing: the deploy renamed every chunk
 * and this tab is still asking for the old names. The event is cancelable, and
 * preventing the default stops Vite rethrowing into a rejected import that
 * would take the whole tree down on its way to `Boundary`.
 *
 * `Boundary` still catches it if this misses — a chunk that fails to *execute*
 * rather than to preload never reaches here — but recovering at the earliest
 * point means the reader sees a reload rather than a panel.
 */
window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnce()) event.preventDefault()
})

/**
 * The same failure arriving as an unhandled rejection.
 *
 * React reports a rejected `lazy()` through the boundary, but a dynamic
 * `import()` fired outside a component — the wiki's markdown extras, a rig
 * loading on demand — rejects with nobody holding it, and the page carries on
 * half-wired with nothing on screen to say why.
 */
window.addEventListener('unhandledrejection', (event) => {
  if (isStaleChunk(event.reason)) reloadOnce()
})

createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <PortalProvider>
        <Boundary>
          <App />
        </Boundary>
      </PortalProvider>
    </BrowserRouter>
  </StrictMode>,
)
