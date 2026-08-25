import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { PortalProvider } from './state/PortalProvider'
import './styles/global.css'

/**
 * The console banner.
 *
 * Anybody who opens devtools on this site is already the kind of person it was
 * built for, so there is something in there for them. The date is the one the
 * wiki derives rather than one it was told, and the last line is hers.
 */
if (typeof console !== 'undefined') {
  console.log(
    '%c弁証薬窟%c  DIALECTICAL DATABASE & DRUG DEN',
    'font:700 22px/1 system-ui;color:#b4ff1a',
    'font:600 12px/1 monospace;color:#00eaff',
  )
  console.log(
    '%cyou are early. type `help` at the shell on the front page, then ignore it —\n' +
      'most of the verbs are not in `help`. start with a name: alu.\n' +
      '06.26 · cardinal water · ruled by the moon · "i peaked in 2008"',
    'font:12px/1.6 monospace;color:#ff2ea6',
  )
}

const root = document.getElementById('root')
if (!root) throw new Error('#root is missing from index.html')

createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <PortalProvider>
        <App />
      </PortalProvider>
    </BrowserRouter>
  </StrictMode>,
)
