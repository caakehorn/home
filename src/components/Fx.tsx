/** Fixed, non-interactive screen furniture: haze, grain, scanlines, vignette. */
export function Fx() {
  return (
    <>
      <div className="fx-layer fx-bleed" aria-hidden="true" style={{ zIndex: 0 }} />
      <div className="fx-layer fx-grain" aria-hidden="true" />
      <div className="fx-layer fx-scanlines" aria-hidden="true" />
      <div className="fx-layer fx-vignette" aria-hidden="true" />
    </>
  )
}
