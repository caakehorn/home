import { useContext, useEffect } from 'react'
import { PortalContext } from './portal-context'

export function usePortal() {
  const value = useContext(PortalContext)
  if (!value) throw new Error('usePortal must be used inside <PortalProvider>')
  return value
}

/**
 * Interactive rigs announce themselves on mount so the HUD can count
 * live elements instead of us hard-coding a number that drifts.
 */
export function useRig(id: string) {
  const { registerRig, pokeRig } = usePortal()
  useEffect(() => registerRig(id), [registerRig, id])
  return () => pokeRig(id)
}
