import board from './board.json'
import { SCENES, SCENE_ORDER, asset, type Plate } from './art'
import { SECTIONS } from './sections'

/* ==========================================================================
   THE BOARD — which picture hangs on which wall, and who decided that

   `art.ts` is the house's own manifest: twelve plates, cut and cropped by
   `scripts/build-art.mjs`, hung by rules written into the components that
   draw them. Those rules are deterministic and they are also *nobody's
   choice* — the front door opens on `kiss-window` because it is third in an
   array, and a room gets whichever plate its index lands on.

   This is the overlay that lets a person overrule that, from the browser,
   without opening an editor. `board.json` is the only thing THE SLATE ROOM
   (`/slates`) writes, `public/art/` is the only place it puts pictures, and
   between them they are the whole of the manual assignment.

   ---- the empty board is today's site -------------------------------------

   Every wall below carries the plate the code already gave it, as `fallback`.
   An empty `board.json` therefore renders exactly the site that existed
   before this file did — not approximately, exactly — and
   `scripts/check-slates.mjs` asserts that against the real component rules
   and exits 1 when it drifts. That is what makes this safe to add to a
   building that was already hung: nothing moves until somebody moves it.

   ---- walls and pools are different things --------------------------------

   A WALL is one specific place: the masthead figure, the left half of the
   front door, the banner over THE ARCADE. Twenty of them, each holding one
   plate, each nameable in a dashboard.

   A POOL is the other case, and it cannot be a wall. There are 486 wiki pages
   and twelve plates; `SectionArt` hashes the page's own path to pick one, so
   that reopening a page does not reshuffle it. Naming a plate per page would
   be 486 rows nobody will ever fill. So a pool is the *set* the hash draws
   from, and the choice on offer is which pictures are eligible — not which
   page gets which.

   ---- why the assignment is allowed to be editorial at all ----------------

   THE RULE at the top of `src/leviathan/core.ts` binds instruments: no number
   here may be a score, a mood or a threshold somebody liked. It binds nothing
   about *furniture*, and this is furniture. But the honesty half of the rule
   still applies — where a drawing decision is a person's taste rather than a
   count, the surface says so. THE ATLAS prints THE MAP IS DRAWN BY HAND on
   every frame; THE SLATE ROOM prints HUNG BY HAND, for the same reason.
   ========================================================================== */

/** A picture uploaded through the room, rather than cut by `build-art.mjs`. */
export type Uploaded = {
  id: string
  /** Basename inside `public/art/`, extension included. Never a full path —
      see the leading-slash note at the top of `art.ts`. */
  file: string
  w: number
  h: number
  alt: string
  kana: string
  tone: 1 | 2 | 3 | 4 | 5
  /** ISO date the room committed it. Recorded, never sorted on. */
  added: string
  /** What it was called on the machine it came off, and what it weighed after
      conversion. Kept so the room can show its own receipts. */
  from?: string
  bytes?: number
}

export type Board = {
  note?: string
  plates: Uploaded[]
  /** Wall id → plate id. A missing key means "whatever the code chose". */
  walls: Record<string, string>
  /** Pool id → the plate ids the hash may draw from. */
  pools: Record<string, string[]>
}

export type Wall = {
  id: string
  /** What it is called in the dashboard. */
  label: string
  /** Where in the building, in a sentence, for somebody who is not looking at it. */
  where: string
  /** The plate the code hangs there when the board says nothing. */
  fallback: string
  /** Anything true about this wall that constrains what belongs on it. */
  caveat?: string
}

export type Pool = {
  id: string
  label: string
  where: string
  /** The set the hash draws from when the board says nothing. */
  fallback: string[]
}

/* --------------------------------------------------------------------------
   The registry. Adding a wall here is the only way to make one assignable,
   which is deliberate: a dashboard that offers a wall the site does not read
   is a dashboard that lies.
   -------------------------------------------------------------------------- */

const ROOM_WALLS: Wall[] = SECTIONS.map((section, i) => ({
  id: `room:${section.slug}`,
  label: section.short ?? section.title,
  where: `The banner under the nav on /${section.slug}.`,
  // `SectionArt`'s own rule, kept here rather than restated: a named room
  // takes its plate by its position in SECTIONS, so no two rooms on the nav
  // bar open on the same picture while the counts match.
  fallback: SCENE_ORDER[i % SCENE_ORDER.length],
}))

export const WALLS: Wall[] = [
  {
    id: 'door-left',
    label: 'THE FRONT DOOR, LEFT',
    where: 'The splash, before the home page — the left of the two plates.',
    fallback: 'kiss-window',
  },
  {
    id: 'door-right',
    label: 'THE FRONT DOOR, RIGHT',
    where: 'The splash, before the home page — the right of the two plates.',
    fallback: 'kiss-neon',
  },
  {
    id: 'mast',
    label: 'THE MASTHEAD FIGURE',
    where: 'Standing in the home page masthead with the heading wrapped around her.',
    fallback: 'kiss-uniform',
    caveat:
      'Drawn with no frame and no tear, so it wants a real alpha channel. Anything on a solid ' +
      'background will read here as a rectangle stuck to the page.',
  },
  {
    id: 'void-1',
    label: 'THE VOID BAND, BIG',
    where: 'The largest of the three overlapping plates in ENTER THE VOID, home page.',
    fallback: 'kiss-water',
  },
  {
    id: 'void-2',
    label: 'THE VOID BAND, MIDDLE',
    where: 'The middle plate in ENTER THE VOID, cut as a shard.',
    fallback: 'kiss-close',
  },
  {
    id: 'void-3',
    label: 'THE VOID BAND, SMALL',
    where: 'The smallest plate in ENTER THE VOID, cut as a rip.',
    fallback: 'kiss-dark',
  },
  ...ROOM_WALLS,
]

export const POOLS: Pool[] = [
  {
    id: 'wiki',
    label: 'EVERY WIKI PAGE',
    where: 'The banner on all 486 pages under /brain. Picked by a hash of the page path.',
    fallback: SCENE_ORDER,
  },
  {
    id: 'blog',
    label: 'EVERY TRANSMISSION',
    where: 'The banner on every post under /blog. Picked by a hash of the post path.',
    fallback: SCENE_ORDER,
  },
]

export const wallById = (id: string) => WALLS.find((w) => w.id === id)
export const poolById = (id: string) => POOLS.find((p) => p.id === id)

/* --------------------------------------------------------------------------
   Reading the board

   `board.json` is bundled, not fetched: the pictures it names have to be
   deployed anyway, so there is never a moment where a fresh board and a stale
   build are both live, and a banner that resolves synchronously cannot flash
   the wrong plate on the way to the right one.

   It is also written by a form, so it is validated rather than trusted. A
   wall id nobody reads, a plate id that was deleted, a tone of 9 — each is
   dropped here and reported by `scripts/check-slates.mjs`, which fails the
   build rather than letting the site quietly render a fallback and look fine.
   -------------------------------------------------------------------------- */

const tone = (n: number): 1 | 2 | 3 | 4 | 5 =>
  (n >= 1 && n <= 5 ? Math.round(n) : 3) as 1 | 2 | 3 | 4 | 5

/** An uploaded row, as the `Plate` the drawing components already understand. */
export const toPlate = (p: Uploaded): Plate => ({
  id: p.id,
  src: asset(`art/${p.file}`),
  w: p.w,
  h: p.h,
  alt: p.alt,
  kana: p.kana,
  tone: tone(p.tone),
})

/** Everything hangable on a given board: the twelve cut by hand, then uploads. */
export const rosterOf = (board: Board): Plate[] => [
  ...SCENES,
  ...(board.plates ?? []).map(toPlate),
]

/**
 * What hangs on a wall, on a given board.
 *
 * Falls back twice, and the second one matters: a board naming a plate that
 * has since been taken down would otherwise return undefined and blank the
 * largest object on the page. `check-slates.mjs` catches that in CI; this
 * catches it in the browser of somebody on an older deploy.
 */
export function hangsOn(board: Board, wallId: string): Plate {
  const roster = rosterOf(board)
  const find = (id: string | undefined) => (id ? roster.find((p) => p.id === id) : undefined)
  const wall = wallById(wallId)
  return find(board.walls?.[wallId]) ?? find(wall?.fallback) ?? roster[0]
}

/** The plate ids a pool draws from on a given board, in board order. */
export function poolOf(board: Board, poolId: string): string[] {
  const roster = rosterOf(board)
  const chosen = (board.pools?.[poolId] ?? []).filter((id) => roster.some((p) => p.id === id))
  if (chosen.length) return chosen
  return poolById(poolId)?.fallback ?? SCENE_ORDER
}

/**
 * A stable index into a pool for one page path.
 *
 * The hash is `SectionArt`'s, unchanged and deliberately so: the index picks
 * the cut and the side as well as the picture, and a different hash would
 * reshuffle the layout of 486 pages nobody asked to have reshuffled.
 */
export function hash(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Which plate a pooled page opens on, on a given board, and the index that drew it. */
export function drawsFrom(board: Board, poolId: string, key: string): { plate: Plate; index: number } {
  const ids = poolOf(board, poolId)
  const roster = rosterOf(board)
  const index = hash(key) % ids.length
  return { plate: roster.find((p) => p.id === ids[index]) ?? roster[0], index }
}

/* --------------------------------------------------------------------------
   The board this deploy was built with

   Everything above takes a board; everything below is that same thing bound
   to the committed one, which is what the site itself draws from. THE SLATE
   ROOM works on a copy and never touches these.
   -------------------------------------------------------------------------- */

export const BOARD: Board = board as Board
export const ROSTER: Plate[] = rosterOf(BOARD)

export const plateById = (id: string): Plate | undefined => ROSTER.find((p) => p.id === id)

/** The uploaded record behind a plate, if it was uploaded rather than cut. */
export const uploadById = (id: string): Uploaded | undefined =>
  (BOARD.plates ?? []).find((p) => p.id === id)

export const hangs = (wallId: string): Plate => hangsOn(BOARD, wallId)
export const poolPlates = (poolId: string): string[] => poolOf(BOARD, poolId)
export const draws = (poolId: string, key: string) => drawsFrom(BOARD, poolId, key)
