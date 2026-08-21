import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Frame } from '../Frame'
import { useSet, type Instrument, type WikiSet } from '../core'
import { usePortal } from '../../state/usePortal'
import { colourWith } from '../ink'

/**
 * ◈ WIKI XV · THE ATTENTION
 *
 * Two counts per page, against each other: **words written on its own page**,
 * and **how many other pages name it**. Everything else on the chart follows
 * from where those two disagree.
 *
 * The far corner — named often, written up thinly — is what the old console
 * called documentation debt. The name is a good one and it is still a reading
 * rather than a measurement, so the instrument prints the two counts and the
 * word "debt" appears nowhere on it. A subject named forty times with two
 * hundred words on it might be under-documented or might be a subject that
 * only needs two hundred words. Nothing here can tell those apart, and the
 * corner is left for the reader to interpret.
 *
 * Neither axis is a ranking. The diagonal is the only claim, and the diagonal
 * is drawn as a guide rather than a threshold — nothing is above or below the
 * line in a sense that scores it.
 */
export function Attention({ instrument }: { instrument: Instrument }) {
  const { data, error, loading } = useSet<WikiSet>('wiki.json')
  const [domain, setDomain] = useState<string | null>(null)
  const [picked, setPicked] = useState<string | null>(null)

  const rows = useMemo(() => {
    if (!data) return []
    return data.attention.filter((row) => !domain || row.domain === domain)
  }, [data, domain])

  if (loading)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">counting words against mentions…</p>
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

  const chosen = picked ? rows.find((r) => r.slug === picked) : null
  /** Named a lot, written up little — the corner, listed rather than scored. */
  const thin = [...rows]
    .filter((r) => r.named >= 4)
    .sort((a, b) => a.words - b.words || b.named - a.named)
    .slice(0, 14)
  const fat = [...rows].sort((a, b) => b.words - a.words).slice(0, 14)

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
            ALL
          </button>
          {data.domains.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`pt-chip${domain === d.id ? ' pt-chip--on' : ''}`}
              aria-pressed={domain === d.id}
              onClick={() => setDomain(domain === d.id ? null : d.id)}
            >
              {d.id.toUpperCase()}
            </button>
          ))}
        </div>
      }
      footer={
        <p className="inst__method">
          <b>THE WORD FOR THE CORNER IS NOT ON THE INSTRUMENT</b> The old console called the
          bottom-right documentation debt, which is a good name and still a reading rather than a
          measurement. A subject named forty times with two hundred words on it might be
          under-documented, or might be a subject that only needs two hundred words. Nothing here
          can tell those apart, so the instrument prints the two counts and leaves the corner to
          the reader. The diagonal is a guide, not a threshold.
        </p>
      }
    >
      <div className="pt-split pt-split--wide">
        <Scatter rows={rows} picked={picked} onPick={setPicked} />

        <div className="pt-stack">
          {chosen ? (
            <>
              <h3 className="pt-sub">{chosen.title.toUpperCase()}</h3>
              <dl className="pt-facts" style={{ marginTop: 0 }}>
                <dt>WRITTEN</dt>
                <dd>{chosen.words.toLocaleString()} words on its own page</dd>
                <dt>NAMED BY</dt>
                <dd>{chosen.named} other pages</dd>
                <dt>DOMAIN</dt>
                <dd>{chosen.domain}</dd>
                <dt>READ IT</dt>
                <dd>
                  <Link to={`/brain/${chosen.slug}`}>/brain/{chosen.slug}</Link>
                </dd>
              </dl>
              <button
                type="button"
                className="pt-chip"
                style={{ justifySelf: 'start' }}
                onClick={() => setPicked(null)}
              >
                CLEAR
              </button>
            </>
          ) : (
            <p className="pt-note">
              Each mark is a page: across is how many other pages name it, up is how many words are
              written on it. Click one to pin it. {rows.length.toLocaleString()} pages shown.
            </p>
          )}

          <h3 className="pt-sub">NAMED OFTEN, WRITTEN UP LEAST</h3>
          <ol className="pt-rows" style={{ ['--pt-label' as string]: '1fr' }}>
            {thin.map((row) => (
              <li key={row.slug}>
                <button
                  type="button"
                  className="pt-row-btn"
                  style={{ ['--pt-label' as string]: '1fr', ['--pt-value' as string]: '5.2rem' }}
                  onClick={() => setPicked(row.slug)}
                >
                  <span className="pt-label">{row.title}</span>
                  <span className="pt-bar">
                    <span
                      className="pt-fill"
                      style={{ inlineSize: `${(row.named / Math.max(...thin.map((t) => t.named))) * 100}%` }}
                    />
                  </span>
                  <span className="pt-value">
                    {row.named}× · {row.words}w
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p className="pt-note">
            Named four times or more, ordered by how little is written. The four is a disclosed
            cut-off for this list only — every page is still on the chart.
          </p>

          <h3 className="pt-sub">WRITTEN UP MOST</h3>
          <ol className="pt-rows" style={{ ['--pt-label' as string]: '1fr' }}>
            {fat.map((row) => (
              <li key={row.slug}>
                <button
                  type="button"
                  className="pt-row-btn"
                  style={{ ['--pt-label' as string]: '1fr', ['--pt-value' as string]: '5.2rem' }}
                  onClick={() => setPicked(row.slug)}
                >
                  <span className="pt-label">{row.title}</span>
                  <span className="pt-bar">
                    <span
                      className="pt-fill pt-fill--alt"
                      style={{ inlineSize: `${(row.words / fat[0].words) * 100}%` }}
                    />
                  </span>
                  <span className="pt-value">
                    {row.named}× · {(row.words / 1000).toFixed(1)}k
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Frame>
  )
}

// ---------------------------------------------------------------------------

type Row = WikiSet['attention'][number]

function Scatter({
  rows,
  picked,
  onPick,
}: {
  rows: Row[]
  picked: string | null
  onPick: (slug: string | null) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const placed = useRef<{ slug: string; x: number; y: number }[]>([])
  const { vibe } = usePortal()

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return

    const ink = getComputedStyle(el)
    const mark = ink.getPropertyValue('--n1').trim() || '#f5c400'
    const grid = ink.getPropertyValue('--text-dim').trim() || '#888'
    const paper = ink.getPropertyValue('--paper').trim() || '#e8e2d4'

    const paint = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = Math.max(300, Math.min(el.getBoundingClientRect().width, 820))
      const h = w * 0.78
      if (el.width !== Math.round(w * dpr)) {
        el.width = Math.round(w * dpr)
        el.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const padL = 46
      const padB = 30
      const plotW = w - padL - 14
      const plotH = h - padB - 16

      // Both axes are log-ish, because both distributions are heavy-tailed: one
      // page has 20,000 words and most have a few hundred, and on a linear axis
      // the chart is a line along the bottom with one dot in the corner. The
      // transform is stated on the axis labels rather than left to be inferred.
      const maxNamed = Math.max(1, ...rows.map((r) => r.named))
      const maxWords = Math.max(1, ...rows.map((r) => r.words))
      const sx = (n: number) => padL + (Math.log1p(n) / Math.log1p(maxNamed)) * plotW
      const sy = (n: number) => 16 + plotH - (Math.log1p(n) / Math.log1p(maxWords)) * plotH

      ctx.font = '9px ui-monospace, monospace'
      ctx.strokeStyle = colourWith(grid, 0.22)
      ctx.lineWidth = 1
      ctx.fillStyle = colourWith(paper, 0.65)

      for (const n of [0, 1, 3, 10, 30, 100, 300]) {
        if (n > maxNamed) continue
        const x = sx(n)
        ctx.beginPath()
        ctx.moveTo(x, 16)
        ctx.lineTo(x, 16 + plotH)
        ctx.stroke()
        ctx.textAlign = 'center'
        ctx.fillText(String(n), x, h - padB + 14)
      }
      for (const n of [0, 100, 500, 2000, 10000]) {
        if (n > maxWords) continue
        const y = sy(n)
        ctx.beginPath()
        ctx.moveTo(padL, y)
        ctx.lineTo(padL + plotW, y)
        ctx.stroke()
        ctx.textAlign = 'right'
        ctx.fillText(n >= 1000 ? `${n / 1000}k` : String(n), padL - 6, y + 3)
      }

      ctx.textAlign = 'left'
      ctx.fillStyle = colourWith(paper, 0.8)
      ctx.fillText('NAMED BY N OTHER PAGES →', padL, h - 6)
      ctx.save()
      ctx.translate(12, 16 + plotH / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.textAlign = 'center'
      ctx.fillText('WORDS ON ITS OWN PAGE →', 0, 0)
      ctx.restore()

      placed.current = []
      for (const row of rows) {
        const x = sx(row.named)
        const y = sy(row.words)
        placed.current.push({ slug: row.slug, x, y })
        const chosen = picked === row.slug
        ctx.beginPath()
        ctx.arc(x, y, chosen ? 5 : 2.4, 0, Math.PI * 2)
        ctx.fillStyle = chosen ? colourWith(paper, 0.95) : colourWith(mark, 0.6)
        ctx.fill()
      }

      if (picked) {
        const row = rows.find((r) => r.slug === picked)
        const at = placed.current.find((p) => p.slug === picked)
        if (row && at) {
          ctx.font = '600 11px ui-monospace, monospace'
          ctx.fillStyle = colourWith(paper, 0.95)
          ctx.textAlign = at.x > w * 0.6 ? 'right' : 'left'
          ctx.fillText(row.title, at.x + (at.x > w * 0.6 ? -8 : 8), at.y - 8)
        }
      }
    }

    paint()
    const observer = new ResizeObserver(paint)
    observer.observe(el)
    return () => observer.disconnect()
  }, [rows, picked, vibe])

  return (
    <figure className="pt-figure">
      <canvas
        ref={canvas}
        className="pt-mount"
        style={{ aspectRatio: '1 / 0.78', cursor: 'crosshair' }}
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect()
          const x = e.clientX - box.left
          const y = e.clientY - box.top
          let best: { slug: string; d: number } | null = null
          for (const p of placed.current) {
            const d = Math.hypot(p.x - x, p.y - y)
            if (d <= 8 && (!best || d < best.d)) best = { slug: p.slug, d }
          }
          onPick(best ? best.slug : null)
        }}
      />
      <figcaption className="pt-legend">
        <span className="pt-key" style={{ color: 'var(--n1)' }}>
          A PAGE
        </span>
        <span className="pt-key-say">
          both axes are log — both distributions are heavy-tailed, and on a linear scale this is a
          line along the bottom with one dot in the corner
        </span>
      </figcaption>
    </figure>
  )
}
