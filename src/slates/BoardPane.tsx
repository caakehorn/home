import {
  POOLS,
  WALLS,
  drawsFrom,
  hangsOn,
  poolOf,
  rosterOf,
  type Board,
} from '../content/slates'

/* ==========================================================================
   THE BOARD — every wall in the building, and what is on it

   One row per wall: what hangs there now, where in the building that is, and
   a picker. The picker's first option is always the plate the *code* would
   have chosen, said by name rather than as "default", because "default" tells
   you nothing about which picture you are about to get back.

   ---- the pools are a different control, deliberately shaped differently ---

   A wall gets a `<select>`: one place, one plate. A pool gets a row of
   toggles: 486 wiki pages hashing over a set, where the answerable question
   is which pictures are eligible, not which page gets which. Rendering them
   the same way would imply the wrong thing about both.

   Each pool shows what its own rule currently produces for two real paths,
   recomputed from the edited board as you toggle. It is the only honest way
   to preview a hash over hundreds of pages: not a promise about all of them,
   one worked example you can check by opening the page.
   ========================================================================== */

/** The walls, in the order somebody walks past them. */
const GROUPS: { title: string; note: string; ids: (walls: typeof WALLS) => string[] }[] = [
  {
    title: 'THE FRONT DOOR',
    note: 'The splash, which stands in front of the home page once a session.',
    ids: () => ['door-left', 'door-right'],
  },
  {
    title: 'THE MAIN FLOOR',
    note: 'The masthead figure and the three overlapping plates in ENTER THE VOID.',
    ids: () => ['mast', 'void-1', 'void-2', 'void-3'],
  },
  {
    title: 'THE ROOMS',
    note: 'One banner under the nav on each named room, in nav-bar order.',
    ids: (walls) => walls.filter((w) => w.id.startsWith('room:')).map((w) => w.id),
  },
]

const SAMPLES: Record<string, string[]> = {
  wiki: ['brain/people/ally-lubin', 'brain/health/cocaine'],
  blog: ['blog/hello-world', 'blog/the-ratio'],
}

type Props = {
  board: Board
  onChange: (next: Board) => void
}

export function BoardPane({ board, onChange }: Props) {
  const roster = rosterOf(board)
  const named = (id: string) => roster.find((p) => p.id === id)

  function hang(wallId: string, plateId: string) {
    const walls = { ...board.walls }
    // An empty pick means "let the code choose again", which is the absence of
    // a key rather than a key holding the fallback's name. Storing the
    // fallback would freeze a room to whatever the rule said today.
    if (plateId) walls[wallId] = plateId
    else delete walls[wallId]
    onChange({ ...board, walls })
  }

  function toggle(poolId: string, plateId: string) {
    const current = poolOf(board, poolId)
    const next = current.includes(plateId)
      ? current.filter((id) => id !== plateId)
      : [...current, plateId]
    const pools = { ...board.pools }
    // A pool emptied entirely is the same as a pool nobody narrowed: the hash
    // needs something to draw from, and an empty set would blank 486 banners.
    if (next.length) pools[poolId] = next
    else delete pools[poolId]
    onChange({ ...board, pools })
  }

  return (
    <div className="sl__pane">
      <p className="sl__lede">
        Every wall the site actually reads, and what is on it. Changing a picker changes nothing
        until you save — and saving commits <code>src/content/board.json</code>, which is one
        deploy away from being live.
      </p>

      {GROUPS.map((group) => (
        <section key={group.title} className="sl__group">
          <h3 className="sl__group-title">{group.title}</h3>
          <p className="sl__hint">{group.note}</p>
          <ul className="sl__walls">
            {group.ids(WALLS).map((wallId) => {
              const wall = WALLS.find((w) => w.id === wallId)
              if (!wall) return null
              const plate = hangsOn(board, wallId)
              const chosen = board.walls?.[wallId] ?? ''
              const fallback = named(wall.fallback)
              return (
                <li key={wallId} className="sl__wall">
                  <img
                    className="sl__thumb"
                    src={plate.src}
                    alt=""
                    width={plate.w}
                    height={plate.h}
                    loading="lazy"
                    decoding="async"
                    style={{ ['--glow' as string]: `var(--n${plate.tone})` }}
                  />
                  <div className="sl__wall-say">
                    <b className="sl__wall-name">{wall.label}</b>
                    <p className="sl__hint">{wall.where}</p>
                    {wall.caveat && <p className="sl__caveat">{wall.caveat}</p>}
                  </div>
                  <div className="sl__wall-pick">
                    <label className="sl__label" htmlFor={`sl-${wallId}`}>
                      {chosen ? 'HUNG BY HAND' : 'AS THE CODE HANGS IT'}
                    </label>
                    <select
                      id={`sl-${wallId}`}
                      className="sl__field"
                      value={chosen}
                      onChange={(e) => hang(wallId, e.target.value)}
                    >
                      {/* The plate name comes first because a `<select>` this
                          narrow truncates, and the one word worth keeping is
                          which picture you get back. */}
                      <option value="">↺ {fallback?.id} — the code's choice</option>
                      {roster.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.id}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <section className="sl__group">
        <h3 className="sl__group-title">THE POOLS</h3>
        <p className="sl__hint">
          The two places that are not one wall. A wiki page or a post picks its plate by a hash of
          its own path, so that reopening it never reshuffles; what is choosable is the set the
          hash draws from. Nothing here is per-page — there are 486 wiki pages.
        </p>

        {POOLS.map((pool) => {
          const chosen = poolOf(board, pool.id)
          const narrowed = (board.pools?.[pool.id] ?? []).length > 0
          return (
            <fieldset key={pool.id} className="sl__pool">
              <legend className="sl__wall-name">{pool.label}</legend>
              <p className="sl__hint">{pool.where}</p>
              <div className="sl__chips">
                {roster.map((p) => {
                  const on = chosen.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`sl__chip${on ? ' sl__chip--on' : ''}`}
                      aria-pressed={on}
                      onClick={() => toggle(pool.id, p.id)}
                      style={{ ['--glow' as string]: `var(--n${p.tone})` }}
                    >
                      <img src={p.src} alt="" width={p.w} height={p.h} loading="lazy" />
                      <span>{p.id}</span>
                    </button>
                  )
                })}
              </div>
              <p className="sl__hint">
                {narrowed
                  ? `${chosen.length} of ${roster.length} plates eligible, chosen by hand.`
                  : `Nobody has narrowed this: all ${chosen.length} cut plates are eligible.`}{' '}
                {SAMPLES[pool.id]?.map((path) => {
                  const drawn = drawsFrom(board, pool.id, path)
                  return (
                    <span key={path} className="sl__sample">
                      <code>/{path}</code> opens on <b>{drawn.plate.id}</b>.{' '}
                    </span>
                  )
                })}
              </p>
            </fieldset>
          )
        })}
      </section>
    </div>
  )
}
