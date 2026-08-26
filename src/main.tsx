import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { Arrival } from './fx/Arrival'
import { Shutter } from './fx/Shutter'
import { ShutterProvider } from './fx/ShutterProvider'
import { Telemetry } from './fx/Telemetry'
import { PortalProvider } from './state/PortalProvider'
import './styles/global.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root is missing from index.html')

/* ==========================================================================
   The three effect layers are mounted HERE rather than inside <App>, above
   the gate and outside the routes.

   The gate is a full-screen state machine that deliberately does not render
   the router until it resolves, and it is made of buttons. If the shutter
   lived inside the routed tree, every press on the front door's own padlock
   would set `data-bang` on <html> — firing the page-wide half of the flash —
   with nothing mounted to draw the other six layers of it. Half an effect is
   worse than none.
   ========================================================================== */

createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <PortalProvider>
        <ShutterProvider>
          <Telemetry />
          <App />
          <Arrival />
          <Shutter />
        </ShutterProvider>
      </PortalProvider>
    </BrowserRouter>
  </StrictMode>,
)
