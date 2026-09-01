import { POOLS, WALLS, hangsOn, poolOf, rosterOf, type Board } from '../content/slates'
import { weigh } from './convert'

/* ==========================================================================
   THE ROSTER — the same assignment, read from the picture's side

   THE BOARD answers "what is on this wall". This answers the other question,
   which is the one somebody who has just uploaded four pictures actually has:
   *where does this one show up?* Same board, transposed, and computed rather
   than stored — a plate's placements are found by asking every wall what it
   is holding, so this view cannot drift from the one that draws the site.

   It is also the only place a plate can be taken down, and taking one down is
   a real deletion: the file leaves `public/art/` and every reference to it
   leaves the board, in one commit. A plate removed from the board but left in
   the folder is an orphan nobody will ever explain; one removed from the
   folder but left on the board fails `check-slates.mjs` and blocks the
   deploy. So both, together, or neither.
   ========================================================================== */

type Props = {
  board: Board
  onTakeDown: (plateId: string) => void
  busy: boolean
  canCommit: boolean
}

export function Roster({ board, onTakeDown, busy, canCommit }: Props) {
  const roster = rosterOf(board)
  const uploaded = new Set((board.plates ?? []).map((p) => p.id))

  /** Every wall this plate is currently hanging on, by name. */
  const wallsFor = (id: string) =>
    WALLS.filter((wall) => hangsOn(board, wall.id).id === id).map((wall) => ({
      label: wall.label,
      byHand: board.walls?.[wall.id] === id,
    }))

  const poolsFor = (id: string) => POOLS.filter((pool) => poolOf(board, pool.id).includes(id))

  return (
    <div className="sl__pane">
      <p className="sl__lede">
        Everything hangable, and everywhere it hangs. Twelve came out of{' '}
        <code>scripts/build-art.mjs</code> and cannot be taken down from here — they are committed
        with the script that cut them. The rest arrived through INTAKE.
      </p>

      <ul className="sl__roster">
        {roster.map((plate) => {
          const record = (board.plates ?? []).find((p) => p.id === plate.id)
          const walls = wallsFor(plate.id)
          const pools = poolsFor(plate.id)
          return (
            <li key={plate.id} className="sl__card" style={{ ['--glow' as string]: `var(--n${plate.tone})` }}>
              <img
                className="sl__card-img"
                src={plate.src}
                alt={plate.alt}
                width={plate.w}
                height={plate.h}
                loading="lazy"
                decoding="async"
              />
              <div className="sl__card-say">
                <b className="sl__wall-name">
                  {plate.id} <span className="jp">{plate.kana}</span>
                </b>
                <p className="sl__meta">
                  {plate.w}×{plate.h}
                  {record?.bytes ? ` · ${weigh(record.bytes)}` : ''} · TONE {plate.tone} ·{' '}
                  {uploaded.has(plate.id) ? `UPLOADED ${record?.added ?? ''}` : 'CUT BY THE SCRIPT'}
                </p>
                <p className="sl__hint">{plate.alt}</p>

                <p className="sl__where">
                  {walls.length === 0 && pools.length === 0 ? (
                    <em>Hanging nowhere. It is in the folder and on no wall.</em>
                  ) : (
                    <>
                      {walls.map((w) => (
                        <span key={w.label} className={`sl__tag${w.byHand ? ' sl__tag--hand' : ''}`}>
                          {w.label}
                        </span>
                      ))}
                      {pools.map((p) => (
                        <span key={p.id} className="sl__tag sl__tag--pool">
                          {p.label}
                        </span>
                      ))}
                    </>
                  )}
                </p>
                {record?.from && (
                  <p className="sl__meta">
                    from <code>{record.from}</code>
                  </p>
                )}

                {uploaded.has(plate.id) && (
                  <button
                    type="button"
                    className="sl__alt-go sl__alt-go--warn"
                    disabled={busy || !canCommit}
                    onClick={() => onTakeDown(plate.id)}
                  >
                    TAKE IT DOWN
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <p className="sl__hint">
        A tag with a rule through it is a wall the code chose; a solid one is a wall somebody
        hung by hand.
      </p>
    </div>
  )
}
