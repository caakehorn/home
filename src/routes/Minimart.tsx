import { Nav } from '../components/Nav'
import { SectionArt } from '../components/SectionArt'
import { SubHead } from '../components/Wordmark'
import { useMinimart, type RepoStats } from '../minimart/core'
import './minimart.css'

/**
 * JERAD'S METRIC MINIMART — 計数
 *
 * Every other room in this building counts something about Dan. This is the
 * one room whose subject is the building itself: how big the two
 * repositories that make it are, how fast they moved, and how much of that
 * was a coding agent rather than a human at a keyboard.
 *
 * ---- the same standard, pointed inward -------------------------------------
 *
 * THE RULE upstairs — no instrument makes a judgement, every number a count,
 * a date or a length — governs the corpus about Dan. This room isn't that
 * corpus, but it inherits the standard anyway: nothing here is a score.
 * Lines of code is a line count with its scope stated. Pull requests is
 * GitHub's own count, captured on a stated date because neither checkout
 * contains it (see `scripts/build-minimart.mjs`). And "hours spent by a
 * coding agent" is flagged RECONSTRUCTED for the same reason THE ATLAS
 * flags a sampled Tuesday: it is the span between a session's first and
 * last commit, summed — a real number, and an upper bound on attention, not
 * a measure of it. Told straight, on the frame, rather than left to read as
 * more certain than it is.
 */

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
function shortDate(iso: string | null) {
  if (!iso) return 'UNKNOWN'
  const [y, m, d] = iso.split('-')
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`
}

const fmt = (n: number) => n.toLocaleString('en-US')

export function MinimartRoute() {
  const { data, error, loading } = useMinimart()

  return (
    <div className="mm">
      <Nav />
      <SectionArt slug="minimart" />
      <header className="wrap mm__mast">
        <h1 className="mm__title">
          <SubHead>JERAD'S METRIC MINIMART</SubHead>
        </h1>
        <span className="mm__kana jp" aria-hidden="true">
          計数
        </span>
        <p className="mm__note">
          Open for business, receipts included. Every figure below is a count, a date or a length
          taken from the two repositories' own history — <code>caakehorn/home</code>, this building,
          and <code>caakehorn/wiki-brain</code>, the corpus underneath it. Nothing is scored or
          ranked; the one number that is a reconstruction rather than a fact says so on its own
          tile.
        </p>
      </header>

      {loading && <p className="wrap mm__status">STOCKING THE SHELVES…</p>}
      {error && (
        <p className="wrap mm__status mm__status--error">
          The register is down: {error}
        </p>
      )}

      {data && (
        <>
          <section className="wrap mm__till" aria-label="totals across both repositories">
            <Tile label="LINES OF CODE" value={fmt(data.combined.linesOfCode)} sub="combined, both repos" />
            <Tile label="COMMITS" value={fmt(data.combined.commits)} sub="combined, both repos" />
            <Tile
              label="PULL REQUESTS"
              value={fmt(data.combined.pullRequests.total)}
              sub={`${fmt(data.combined.pullRequests.merged)} merged`}
            />
            <Tile
              label="CODING-AGENT SESSIONS"
              value={fmt(data.combined.codingAgentSessions.count)}
              sub="distinct Claude Code sessions"
            />
            <Tile
              label="AGENT SESSION-SPAN"
              value={`${fmt(Math.round(data.combined.codingAgentSessions.spanHours))}h`}
              sub="RECONSTRUCTED — see below"
              flag
            />
          </section>

          <div className="wrap mm__shelves">
            <RepoShelf title="THE SITE" subtitle="caakehorn/home" stats={data.repos.home} />
            {data.repos.wikiBrain && (
              <RepoShelf title="THE BRAIN" subtitle="caakehorn/wiki-brain" stats={data.repos.wikiBrain} />
            )}
          </div>

          <section className="wrap mm__receipt">
            <h2 className="mm__receipt-title">THE RECEIPT</h2>
            <p>
              <b>Lines of code</b> is a line count over tracked files in each repo's own code
              directories — the scope is printed on each shelf below it, because what counts as
              "code" here is an editorial call (config files, generated data payloads and lockfiles
              are excluded) and a call like that gets said out loud rather than hidden in a number.
            </p>
            <p>
              <b>Pull requests</b> is GitHub's own count for each repository, not a replay of{' '}
              <code>git log</code> — a squash-merged pull request leaves no merge commit, which
              undercounts the real total by more than half on both repos. Captured{' '}
              {shortDate(data.repos.home.pullRequests.capturedAt)}; refreshed by re-running the
              same GitHub search, not by every build.
            </p>
            <p>
              <b>Coding-agent sessions</b> are counted from the <code>Claude-Session:</code> trailer
              every agent-made commit carries. <b>Session-span</b> sums, per session, the time
              between its first commit and its last — a real, checkable number, and an{' '}
              <i>upper bound</i> on attention, not a measure of it: idle time between two commits in
              the same session counts the same as time spent writing the second one, and a session
              resumed the next day counts that whole gap too. Read it as "how long the register was
              open," not "how long somebody stood at it."
            </p>
            <p className="mm__receipt-stamp">Rung up {data.generatedAt.slice(0, 10)}.</p>
          </section>
        </>
      )}
    </div>
  )
}

function Tile({
  label,
  value,
  sub,
  flag,
}: {
  label: string
  value: string
  sub?: string
  flag?: boolean
}) {
  return (
    <div className={`mm-tile${flag ? ' mm-tile--flag' : ''}`}>
      <span className="mm-tile__value">{value}</span>
      <span className="mm-tile__label">{label}</span>
      {sub && <span className="mm-tile__sub">{sub}</span>}
    </div>
  )
}

function RepoShelf({ title, subtitle, stats }: { title: string; subtitle: string; stats: RepoStats }) {
  const authors = Object.entries(stats.commits.byAuthor).sort((a, b) => b[1] - a[1])
  return (
    <article className="mm-shelf">
      <header className="mm-shelf__head">
        <h3>{title}</h3>
        <span className="mm-shelf__subtitle">{subtitle}</span>
      </header>

      <dl className="mm-shelf__stats">
        <div>
          <dt>Lines of code</dt>
          <dd>
            {fmt(stats.linesOfCode.lines)}{' '}
            <span className="mm-shelf__soft">({fmt(stats.linesOfCode.files)} files)</span>
          </dd>
        </div>
        {stats.wikiContentLines && (
          <div>
            <dt>Wiki content (not code)</dt>
            <dd>
              {fmt(stats.wikiContentLines.lines)}{' '}
              <span className="mm-shelf__soft">({fmt(stats.wikiContentLines.files)} pages)</span>
            </dd>
          </div>
        )}
        <div>
          <dt>Commits</dt>
          <dd>{fmt(stats.commits.total)}</dd>
        </div>
        <div>
          <dt>Pull requests</dt>
          <dd>
            {fmt(stats.pullRequests.total)}{' '}
            <span className="mm-shelf__soft">({fmt(stats.pullRequests.merged)} merged)</span>
          </dd>
        </div>
        <div>
          <dt>Coding-agent sessions</dt>
          <dd>
            {fmt(stats.commits.codingAgentSessions.count)}{' '}
            <span className="mm-shelf__soft">
              ({fmt(Math.round(stats.commits.codingAgentSessions.spanHours))}h span)
            </span>
          </dd>
        </div>
        <div>
          <dt>Active since</dt>
          <dd>
            {shortDate(stats.commits.firstCommit)}
            <span className="mm-shelf__soft"> — {stats.commits.ageDays} days</span>
          </dd>
        </div>
      </dl>

      <p className="mm-shelf__scope">{stats.linesOfCode.scope}</p>

      <table className="mm-shelf__authors">
        <caption>Commits by author</caption>
        <tbody>
          {authors.map(([name, count]) => (
            <tr key={name}>
              <th scope="row">{name}</th>
              <td>{fmt(count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  )
}
