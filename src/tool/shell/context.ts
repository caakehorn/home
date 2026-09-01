import { createContext, useContext } from 'react'
import type { ShellApi } from './types'

export const ShellContext = createContext<ShellApi | null>(null)

/**
 * The terminal, from inside a tool's own panels.
 *
 * Throws rather than returning null when a panel is mounted outside a shell:
 * that is a wiring mistake at build time, and a panel that silently does
 * nothing is much harder to notice than one that refuses to render.
 */
export function useShell(): ShellApi {
  const api = useContext(ShellContext)
  if (!api) throw new Error('useShell() outside a <Shell> — a tool panel must be mounted by the shell')
  return api
}
