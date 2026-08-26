import { useContext } from 'react'
import { ShutterContext } from './shutter-context'

/**
 * The shutter, imperatively.
 *
 * Almost nothing needs this — the delegated listener in ShutterProvider
 * already covers every button and every link on the site, and a component that
 * reaches for this to flash on its own click is duplicating a bang it is
 * already getting. What it is for is the events that are not a press: a
 * terminal command that resolves, a relic that turns out to be the tenth one,
 * a route that finished arriving.
 */
export function useShutter() {
  const value = useContext(ShutterContext)
  if (!value) throw new Error('useShutter must be used inside <ShutterProvider>')
  return value
}
