import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Frame } from '../Frame'
import { DOMAIN_KANA, useSet, type Instrument, type WikiNode, type WikiSet } from '../core'
import { usePortal } from '../../state/usePortal'
import { colourWith } from '../ink'

/**
 * ◈ WIKI II · THE WEB
 *
 * The whole second brain as one graph: 486 pages, 3,536 links, nothing pinned
 * and nothing hidden. Every page is a node sized by how much is written on it
 * and every link one page makes to another is an edge.
 *
 * ---- the layout is not the data -------------------------------------------
 *
 * The positions come from the map at /brain rather than from a force
 * simulation run here, and that is the honest arrangement rather than the lazy
 * one: a simulation started twice gives two different pictures of the same
 * graph, and a reader who cannot tell which parts of a drawing are the data
 * cannot read it. Here the edges are the data, the coordinates are a drawing
 * decision made once, in another room, and the two rooms agree because they use
 * the same numbers. The instrument says so under the picture.
 *
 * Colour is domain and nothing else. Size is word count and nothing else.
 * Neither encodes importance, because nothing here knows what that would mean.
 *
 * The ramp has five inks and there are nine domains, so two domains share a
 * colour — and in RIOT, which is two inks, most of them do. That is stated
 * under the picture rather than papered over with a ninth invented hue: the
 * domain filter is the reliable way to isolate one, and colour is a hint.
 */
export function Web({ instrument }: { instrument: Instrument }) {
  const { data, error, loading } = useSet<WikiSet>('wiki.json')
  const [picked, setPicked] = useState<string | null>(null)
  const [domain, setDomain] = useState<string | null>(null)

  const hit = useMemo(
    () => (data ? new Map(data.web.nodes.map((n) => [n.slug, n])) : new Map<string, WikiNode>()),
    [data],
  )

  if (loading)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">drawing the graph…</p>
      </Frame>
    )

  if (error || !data)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">
          The dataset is missing ({error}). Run <code>npm run wiki-instruments</code> and rebuild.
        </p>
      </Frame>
    )

  const node = picked ? hit.get(picked) : null
  const neighbours = node
    ? data.web.edges
        .filter(([from, to]) => from === node.slug || to === node.slug)
        .map(([from, to]) => (from === node.slug ? to : from))
    : []
  const busiest = [...data.web.nodes].sort((a, b) => b.in + b.out - (a.in + a.out)).slice(0, 14)

  return (
    <Frame
      instrument={instrument}
      controls={
        <div className="pt-chips" role="group" aria-label="Domain">
          <button
            type="button"
            className={`pt-chip${domain === null ? ' pt-chip--on' : ''}`}
            aria-pressed={domain === null}
            onClick={() => setDomain(null)}
          >
            ALL {data.counts.pages}
          </button>
          {data.domains.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`pt-chip${domain === d.id ? ' pt-chip--on' : ''}`}
              aria-pressed={domain === d.id}
              onClick={() => setDomain(domain === d.id ? null : d.id)}
            >
              {d.id.toUpperCase()} {d.count}
            </button>
          ))}
        </div>
      }
      footer={
        <p className="inst__method">
          <b>THE LAYOUT IS NOT THE DATA</b> The coordinates come from the map at{' '}
          <Link to="/brain">/brain</Link> rather than from a simulation run here. A force layout
          started twice gives two different pictures of the same graph, and a reader who cannot tell
          which parts of a drawing are the data cannot read it. The edges are the data; where a node
          sits is a drawing decision made once, in another room, which is why the two rooms agree.
        </p>
      }
    >
      <div className="pt-split pt-split--wide">
        <Graph data={data} picked={picked} domain={domain} onPick={setPicked} />

        <div className="pt-stack">
          {node ? (
            <>
              <h3 className="pt-sub">{node.title.toUpperCase()}</h3>
              <p className="pt-note">
                <b>{node.domain.toUpperCase()}</b>{' '}
                <span className="jp">{DOMAIN_KANA[node.domain] ?? ''}</span> ·{' '}
                {node.words.toLocaleString()} words · points at {node.out}, pointed at by {node.in}
              </p>
              <p className="pt-note">
                <Link to={`/brain/${node.slug}`}>READ THE PAGE →</Link>{' '}
                <button
                  type="button"
                  className="pt-chip"
                  style={{ padding: '0.05rem 0.35rem' }}
                  onClick={() => setPicked(null)}
                >
                  CLEAR
                </button>
              </p>
              <h3 className="pt-sub">WHAT IT TOUCHES · {neighbours.length}</h3>
              <ul className="pt-rows pt-scroll">
                {[...new Set(neighbours)].map((slug) => {
                  const other = hit.get(slug)
                  if (!other) return null
                  return (
                    <li key={slug} className="pt-row" style={{ ['--pt-label' as string]: '1fr' }}>
                      <button
                        type="button"
                        className="pt-row-btn"
                        style={{ ['--pt-label' as string]: '1fr', ['--pt-value' as string]: '3.4rem' }}
                        onClick={() => setPicked(slug)}
                      >
                        <span className="pt-label">{other.title}</span>
                        <span className="pt-bar" />
                        <span className="pt-value">{other.domain.slice(0, 6)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <>
              <p className="pt-note">
                Click any node to pin it. Colour is the domain, size is the word count, and an edge
                is one page naming another. Nothing is pinned and nothing is hidden — all{' '}
                {data.counts.pages} pages and all {data.web.edges.length.toLocaleString()} links are
                on the canvas.
              </p>

              <h3 className="pt-sub">MOST CONNECTED PAGES</h3>
              <ol className="pt-rows" style={{ ['--pt-label' as string]: '1fr' }}>
                {busiest.map((row) => (
                  <li key={row.slug}>
                    <button
                      type="button"
                      className="pt-row-btn"
                      style={{ ['--pt-label' as string]: '1fr', ['--pt-value' as string]: '3.4rem' }}
                      onClick={() => setPicked(row.slug)}
                    >
                      <span className="pt-label">{row.title}</span>
                      <span className="pt-bar">
                        <span
                          className="pt-fill"
                          style={{
                            inlineSize: `${((row.in + row.out) / (busiest[0].in + busiest[0].out)) * 100}%`,
                          }}
                        />
                      </span>
                      <span className="pt-value">{row.in + row.out}</span>
                    </button>
                  </li>
                ))}
              </ol>

              <dl className="pt-facts">
                <dt>PAGES</dt>
                <dd>{data.counts.pages.toLocaleString()}</dd>
                <dt>LINKS</dt>
                <dd>{data.web.edges.length.toLocaleString()} one page naming another</dd>
                <dt>BOTH WAYS</dt>
                <dd>
                  {(data.health.reciprocal / 2).toLocaleString()} pairs point at each other ·{' '}
                  {((data.health.reciprocal / data.health.edges) * 100).toFixed(0)}% of links
                </dd>
                <dt>POINTED AT BY NOTHING</dt>
                <dd>{data.health.orphans.length} pages</dd>
              </dl>
            </>
          )}
        </div>
      </div>
    </Frame>
  )
}

// ---------------------------------------------------------------------------

/** One hue per domain, taken off the ramp so the room follows the vibe. */
const DOMAIN_TONE: Record<string, string> = {
  people: '--n1',
  interests: '--n3',
  mind: '--n2',
  timeline: '--n4',
  self: '--n5',
  work: '--n1',
  places: '--n3',
  health: '--n2',
  legal: '--n4',
}

function Graph({
  data,
  picked,
  domain,
  onPick,
}: {
  data: WikiSet
  picked: string | null
  domain: string | null
  onPick: (slug: string | null) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const placed = useRef<{ slug: string; x: number; y: number; r: number }[]>([])
  const { vibe } = usePortal()

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return

    const ink = getComputedStyle(el)
    const tone = (id: string) =>
      ink.getPropertyValue(DOMAIN_TONE[id] ?? '--n1').trim() || '#f5c400'
    const line = ink.getPropertyValue('--text-dim').trim() || '#888'
    const paper = ink.getPropertyValue('--paper').trim() || '#e8e2d4'

    const paint = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const size = Math.max(320, Math.min(el.getBoundingClientRect().width, 860))
      if (el.width !== Math.round(size * dpr)) {
        el.width = Math.round(size * dpr)
        el.height = Math.round(size * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size, size)

      const pad = size * 0.06
      const span = size - pad * 2
      // The stored coordinates are roughly -1..1; fit them rather than assume.
      const xs = data.web.nodes.map((n) => n.x)
      const ys = data.web.nodes.map((n) => n.y)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      const at = (n: { x: number; y: number }) => ({
        x: pad + ((n.x - minX) / Math.max(1e-6, maxX - minX)) * span,
        y: pad + ((n.y - minY) / Math.max(1e-6, maxY - minY)) * span,
      })

      const points = new Map(data.web.nodes.map((n) => [n.slug, at(n)]))
      const lit = (slug: string) =>
        (!domain || data.web.nodes.find((n) => n.slug === slug)?.domain === domain) &&
        (!picked || slug === picked)

      // edges first, under everything
      for (const [from, to] of data.web.edges) {
        const a = points.get(from)
        const b = points.get(to)
        if (!a || !b) continue
        const touching = picked ? from === picked || to === picked : true
        ctx.strokeStyle = colourWith(picked && touching ? paper : line, picked ? (touching ? 0.5 : 0.05) : 0.12)
        ctx.lineWidth = picked && touching ? 1.1 : 0.6
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }

      const words = data.web.nodes.map((n) => n.words)
      const top = Math.max(1, ...words)
      placed.current = []

      for (const node of data.web.nodes) {
        const p = points.get(node.slug)!
        // Square root, so a 20,000-word page is not 40 times the area of a
        // 500-word one — disclosed on the instrument, and the only transform here.
        const r = 1.6 + Math.sqrt(node.words / top) * (size * 0.018)
        placed.current.push({ slug: node.slug, x: p.x, y: p.y, r: Math.max(r, 4) })

        const dim = domain && node.domain !== domain
        const chosen = picked === node.slug
        ctx.beginPath()
        ctx.arc(p.x, p.y, chosen ? r + 2 : r, 0, Math.PI * 2)
        ctx.fillStyle = chosen
          ? colourWith(paper, 0.95)
          : colourWith(tone(node.domain), dim ? 0.12 : picked ? 0.3 : 0.72)
        ctx.fill()
        if (chosen) {
          ctx.strokeStyle = colourWith(tone(node.domain), 0.95)
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }

      if (picked) {
        const node = data.web.nodes.find((n) => n.slug === picked)
        const p = points.get(picked)
        if (node && p) {
          ctx.font = '600 12px ui-monospace, monospace'
          ctx.fillStyle = colourWith(paper, 0.95)
          ctx.textAlign = 'center'
          ctx.fillText(node.title, p.x, p.y - 14)
        }
      }
      void lit
    }

    paint()
    const observer = new ResizeObserver(paint)
    observer.observe(el)
    return () => observer.disconnect()
  }, [data, picked, domain, vibe])

  return (
    <figure className="pt-figure">
      <canvas
        ref={canvas}
        className="pt-mount pt-mount--square"
        style={{ cursor: 'crosshair' }}
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect()
          const x = e.clientX - box.left
          const y = e.clientY - box.top
          let best: { slug: string; d: number } | null = null
          for (const node of placed.current) {
            const d = Math.hypot(node.x - x, node.y - y)
            if (d <= node.r + 4 && (!best || d < best.d)) best = { slug: node.slug, d }
          }
          onPick(best ? best.slug : null)
        }}
      />
      <figcaption className="pt-legend">
        {Object.keys(DOMAIN_TONE).map((id) => (
          <span key={id} className="pt-key" style={{ color: `var(${DOMAIN_TONE[id]})` }}>
            {id.toUpperCase()}
          </span>
        ))}
        <span className="pt-key-say">
          nine domains, five inks — two share a colour, so the filter above is the reliable way to
          isolate one · size is word count, square-rooted · click a node
        </span>
      </figcaption>
    </figure>
  )
}
