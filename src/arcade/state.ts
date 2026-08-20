import { useCallback, useEffect, useState } from 'react'

/* ==========================================================================
   THE TOKEN CUP

   An arcade that forgets you between cabinets is not an arcade, it is four
   demos. Scores, tickets and redeemed prizes live in localStorage under one
   key, and every screen in the room reads the same cup.

   Storage is best-effort on purpose: private windows and locked-down browsers
   throw on `setItem`, and a game about a woman who is wary of being archived
   should not be the thing on this site that falls over when the archive is
   unavailable.
   ========================================================================== */

const KEY = 'alu-arcade-v1'

export type Purse = {
  /** Best score per cabinet id. */
  best: Record<string, number>
  /** Tickets banked, minus tickets spent. */
  tickets: number
  /** Lifetime tickets earned — the counter never goes down. */
  earned: number
  /** Prize ids already redeemed. */
  prizes: string[]
}

const EMPTY: Purse = { best: {}, tickets: 0, earned: 0, prizes: [] }

function read(): Purse {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<Purse>
    return {
      best: parsed.best ?? {},
      tickets: parsed.tickets ?? 0,
      earned: parsed.earned ?? 0,
      prizes: parsed.prizes ?? [],
    }
  } catch {
    return EMPTY
  }
}

function write(purse: Purse) {
  try {
    localStorage.setItem(KEY, JSON.stringify(purse))
  } catch {
    /* the cup is still full in memory; only the shelf is unavailable */
  }
}

/** One event bus so two mounted screens never disagree about the total. */
const listeners = new Set<(p: Purse) => void>()
let current: Purse | null = null

function commit(next: Purse) {
  current = next
  write(next)
  listeners.forEach((fn) => fn(next))
}

export function useArcade() {
  const [purse, setPurse] = useState<Purse>(() => (current ??= read()))

  useEffect(() => {
    listeners.add(setPurse)
    return () => {
      listeners.delete(setPurse)
    }
  }, [])

  /** Bank a round. Every round pays, which is how an arcade has always worked
      — a machine that only pays the first time you beat yourself is a machine
      nobody puts a second coin in. `best` is kept as a separate bragging stat
      and has no bearing on the till. */
  const bank = useCallback((cab: string, score: number, tickets: number) => {
    const p = current ?? read()
    const won = Math.max(0, tickets)
    commit({
      best: { ...p.best, [cab]: Math.max(p.best[cab] ?? 0, score) },
      tickets: p.tickets + won,
      earned: p.earned + won,
      prizes: p.prizes,
    })
    return won
  }, [])

  const redeem = useCallback((id: string, cost: number) => {
    const p = current ?? read()
    if (p.prizes.includes(id) || p.tickets < cost) return false
    commit({ ...p, tickets: p.tickets - cost, prizes: [...p.prizes, id] })
    return true
  }, [])

  const wipe = useCallback(() => commit(EMPTY), [])

  return { purse, bank, redeem, wipe }
}

/** Score → tickets. One ticket per hundred points, as the machine promises. */
export const ticketsFor = (score: number) => Math.max(0, Math.floor(score / 100))
