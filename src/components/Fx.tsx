/**
 * Fixed, non-interactive screen furniture: haze, grain, scanlines, vignette,
 * and the toner layer.
 *
 * `fx-toner` is the punk one: a halftone dot screen and a diagonal band of
 * copier flare, multiplied over the whole page so everything on it reads as
 * having been through the machine once. It sits above the CRT effects because
 * the photocopy is the last thing that happened to the page.
 *
 * `rail` is the odd one out and the only thing here that is information: a
 * two-pixel hairline under the top crawl, scaled on X by how far down the
 * document you are. It reads `--sp` off TELEMETRY, so it costs one `scaleX` on
 * an already-composited layer and there is no scroll listener behind it that
 * is not already running.
 */
export function Fx() {
  return (
    <>
      <div className="fx-layer fx-bleed" aria-hidden="true" style={{ zIndex: 0 }} />
      <div className="fx-layer fx-grain" aria-hidden="true" />
      <div className="fx-layer fx-scanlines" aria-hidden="true" />
      <div className="fx-layer fx-vignette" aria-hidden="true" />
      <div className="fx-layer fx-toner" aria-hidden="true" />
      <div className="rail" aria-hidden="true" />
    </>
  )
}
