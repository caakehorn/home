import { useEffect, useState } from 'react'
import { Nav } from '../components/Nav'
import { SectionArt } from '../components/SectionArt'
import { SubHead } from '../components/Wordmark'
import { BOARD, WALLS, type Board, type Uploaded } from '../content/slates'
import { ready } from '../wiki/keyring'
import { BoardPane } from './BoardPane'
import { Intake } from './Intake'
import { Roster } from './Roster'
import { commitBoard, commitPlate, commitRemoval, readBoard, serialise } from './publish-slates'
import './slate-room.css'

/* ==========================================================================
   THE SLATE ROOM — 掲示

   The one room in this building whose subject is the building's own pictures.
   Everything else here is drawn by a rule: `SectionArt` gives a room the plate
   its index lands on, the front door opens on whatever is third in an array,
   and none of that was anybody's decision about *this picture on that wall*.
   This is where those become decisions, and where a picture off a phone
   becomes a plate in `public/art/` without a terminal.

   ---- and it is a room like the others now ---------------------------------

   It used to be unlisted, on the reasoning `/ledger` is unlisted by: not in
   SECTIONS, no chip in the nav bar, reached by typing the URL. That reasoning
   is real for a substance tracker and imaginary for a picture dashboard — all
   it bought was a room nobody could find. So `slates` is a row in SECTIONS,
   which is also what makes `room:slates` a wall, which is why the banner below
   is a `<SectionArt>` like every other room's. The room is inside its own
   registry: the wall you are standing under is one of the walls THE BOARD
   offers, and it can be re-hung from in here.

   ---- it says HUNG BY HAND on the frame ------------------------------------

   THE RULE at the top of `src/leviathan/core.ts` binds the instruments: every
   number a count, a date or a length, nothing scored, no threshold picked for
   what it would surface. This room is furniture rather than an instrument and
   the rule does not reach it — but the honesty half does, and THE ATLAS is
   the precedent: it prints THE MAP IS DRAWN BY HAND on every frame because
   its roads are typed rather than surveyed. Every assignment made here is one
   person's taste, so the room says so where it can be read, and the board
   records which walls were hung by hand and which were left to the code.

   ---- two boards, and which one you are looking at -------------------------

   The board is bundled into the build, so the copy this page starts from is
   the copy the *deployed site* is drawing with. That is one deploy behind the
   repository from the moment anything is saved. A dashboard that edited the
   bundled copy would silently undo the previous save, so the room reads the
   committed board over the API before it lets anything change, adopts it when
   it differs, and says which of the two is on screen. When there is no
   keyring in the tab it can only show the bundled one — and it says that too,
   rather than pretending to be authoritative.
   ========================================================================== */

const clone = (board: Board): Board => JSON.parse(JSON.stringify(board)) as Board

type Pane = 'intake' | 'board' | 'roster'

const PANES: { id: Pane; label: string; kana: string }[] = [
  { id: 'intake', label: 'INTAKE', kana: '現像' },
  { id: 'board', label: 'THE BOARD', kana: '掲示' },
  { id: 'roster', label: 'THE ROSTER', kana: '一覧' },
]

/** What changed between two boards, in words, for the commit message. */
function describe(before: Board, after: Board): string {
  const hung = Object.keys(after.walls ?? {}).filter(
    (id) => (before.walls ?? {})[id] !== after.walls[id],
  )
  const dropped = Object.keys(before.walls ?? {}).filter((id) => !(id in (after.walls ?? {})))
  const pools = [...new Set([...Object.keys(before.pools ?? {}), ...Object.keys(after.pools ?? {})])]
    .filter((id) => JSON.stringify((before.pools ?? {})[id]) !== JSON.stringify((after.pools ?? {})[id]))

  const parts: string[] = []
  for (const id of hung) {
    const wall = WALLS.find((w) => w.id === id)
    parts.push(`${wall?.label ?? id} → ${after.walls[id]}`)
  }
  for (const id of dropped) {
    const wall = WALLS.find((w) => w.id === id)
    parts.push(`${wall?.label ?? id} back to the code's choice`)
  }
  for (const id of pools) parts.push(`the ${id} pool`)
  return parts.join(', ')
}

export function SlateRoom() {
  const [board, setBoard] = useState<Board>(() => clone(BOARD))
  /** The board as committed, once known. Everything diffs against this. */
  const [base, setBase] = useState<Board>(() => clone(BOARD))
  const [from, setFrom] = useState<'deploy' | 'repo'>('deploy')
  const [pane, setPane] = useState<Pane>('board')
  const [canCommit, setCanCommit] = useState<boolean | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  // What the repository holds, before anything is allowed to change.
  useEffect(() => {
    let live = true
    ;(async () => {
      const ok = await ready()
      if (!live) return
      setCanCommit(ok)
      if (!ok) return
      try {
        const committed = await readBoard()
        if (!live || !committed) return
        if (serialise(committed.board) !== serialise(BOARD)) {
          setBoard(clone(committed.board))
          setBase(clone(committed.board))
        }
        setFrom('repo')
      } catch (err) {
        // Not fatal: the bundled board is a real board, one deploy old at
        // worst. Say which one is on screen rather than refusing to open.
        if (live) setProblem(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      live = false
    }
  }, [])

  const dirty = serialise(board) !== serialise(base)

  async function run(what: () => Promise<string>, opening: string) {
    setBusy(opening)
    setProblem(null)
    setDone(null)
    try {
      const url = await what()
      setDone(url)
    } catch (err) {
      setProblem(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  function save() {
    const changed = describe(base, board)
    const next = clone(board)
    return run(async () => {
      const url = await commitBoard(
        next,
        `Re-hang the slates${changed ? ` — ${changed}` : ''}`,
        setBusy,
      )
      setBase(clone(next))
      return url
    }, 'saving the board…')
  }

  function publish(plate: Uploaded, base64: string) {
    const next = clone(board)
    next.plates = [...(next.plates ?? []), plate]
    return run(async () => {
      const url = await commitPlate(
        next,
        { file: plate.file, base64 },
        `Add the plate ${plate.id}`,
        setBusy,
      )
      setBoard(clone(next))
      setBase(clone(next))
      setPane('board')
      return url
    }, 'committing the picture…')
  }

  function takeDown(plateId: string) {
    const record = (board.plates ?? []).find((p) => p.id === plateId)
    if (!record) return
    const where = WALLS.filter((w) => board.walls?.[w.id] === plateId).map((w) => w.label)
    const warning = where.length
      ? `${plateId} is hanging on ${where.join(', ')}. Taking it down puts those walls back to the code's choice.\n\n`
      : ''
    if (!window.confirm(`${warning}Delete public/art/${record.file} and its row? This commits.`)) {
      return
    }

    const next = clone(board)
    next.plates = (next.plates ?? []).filter((p) => p.id !== plateId)
    for (const id of Object.keys(next.walls ?? {})) {
      if (next.walls[id] === plateId) delete next.walls[id]
    }
    for (const id of Object.keys(next.pools ?? {})) {
      const kept = next.pools[id].filter((p) => p !== plateId)
      if (kept.length) next.pools[id] = kept
      else delete next.pools[id]
    }

    return run(async () => {
      const url = await commitRemoval(next, record.file, `Take down the plate ${plateId}`, setBusy)
      setBoard(clone(next))
      setBase(clone(next))
      return url
    }, 'taking it down…')
  }

  return (
    <div className="sl">
      <Nav />
      {/* The room is a room like any other now, and it takes the banner every
          other room takes — which also means `room:slates` is a wall the site
          actually reads, rather than a row the board offers and nothing
          renders. The registry in `content/slates.ts` is explicit that a
          dashboard offering a dead wall is a dashboard that lies. */}
      <SectionArt slug="slates" />
      <header className="wrap sl__mast">
        <h1 className="sl__title">
          <SubHead>THE SLATE ROOM</SubHead>
        </h1>
        <span className="sl__mast-kana jp" aria-hidden="true">
          掲示
        </span>
        <p className="sl__stamp">HUNG BY HAND</p>
        <p className="sl__note">
          Every picture in this building is hung by a rule — a room takes the plate its index lands
          on, the front door opens on whichever is third in an array. Nothing about that is a
          decision about <em>this</em> picture on <em>that</em> wall. This is where it becomes one,
          and where a JPEG off a phone becomes a WebP in <code>public/art/</code> without a
          terminal. What is chosen here is one person's taste, which is why it says so above.
        </p>

        <p className="sl__state">
          <span className={`sl__light sl__light--${canCommit === null ? 'wait' : canCommit ? 'on' : 'off'}`} />
          {canCommit === null
            ? 'CHECKING THE KEYRING…'
            : canCommit
              ? from === 'repo'
                ? 'READING THE COMMITTED BOARD · SAVES GO STRAIGHT TO THE REPOSITORY'
                : 'KEYRING OPEN · SHOWING THE BUNDLED BOARD'
              : 'NO KEYRING IN THIS TAB · READ-ONLY, AND THE BOARD SHOWN IS THIS DEPLOY’S'}
        </p>
      </header>

      <nav className="wrap sl__tabs" aria-label="Slate room">
        {PANES.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`sl__tab${pane === p.id ? ' sl__tab--on' : ''}`}
            aria-current={pane === p.id}
            onClick={() => setPane(p.id)}
          >
            <span className="jp" aria-hidden="true">
              {p.kana}
            </span>
            {p.label}
          </button>
        ))}
      </nav>

      <div className="wrap sl__body">
        {busy && <p className="sl__status">{busy}</p>}
        {problem && <p className="sl__warn">{problem}</p>}
        {done && (
          <p className="sl__status sl__status--good">
            Committed. The site rebuilds in a minute or two —{' '}
            <a href={done} target="_blank" rel="noreferrer">
              the commit
            </a>
            . Until it lands, this page still shows the old pictures.
          </p>
        )}

        {pane === 'intake' && (
          <Intake board={board} onPublish={publish} canCommit={!!canCommit} busy={!!busy} />
        )}
        {pane === 'board' && <BoardPane board={board} onChange={setBoard} />}
        {pane === 'roster' && (
          <Roster board={board} onTakeDown={takeDown} busy={!!busy} canCommit={!!canCommit} />
        )}
      </div>

      {/* The save bar is only in the way when there is something to save. */}
      {pane === 'board' && dirty && (
        <div className="sl__bar">
          <span className="sl__bar-note">{describe(base, board) || 'the board has changed'}</span>
          <button type="button" className="sl__alt-go" onClick={() => setBoard(clone(base))}>
            PUT IT BACK
          </button>
          <button type="button" className="sl__go" disabled={!!busy || !canCommit} onClick={save}>
            {busy ? 'SAVING…' : 'SAVE THE BOARD'}
          </button>
        </div>
      )}
    </div>
  )
}
