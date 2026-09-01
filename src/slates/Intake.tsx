import { useEffect, useRef, useState } from 'react'
import { Plate } from '../components/Plate'
import { rosterOf, type Board, type Uploaded } from '../content/slates'
import { EDGES, HEAVY_BYTES, convert, slugify, toBase64, weigh, type Converted } from './convert'

/* ==========================================================================
   INTAKE — a file off the machine becomes a plate in `public/art/`

   The form is four fields and a picture, and three of the fields are the ones
   `public/art/README.md` says a plate needs: alt text, because several plates
   are the largest object on their page and a screen reader handed nothing for
   one of those has been lied to; a kana, because `Plate` lights one in the
   corner of every frame; and a tone, because the halftone and the wash follow
   `--n1`…`--n5` and a plate with no tone would take whichever one it was
   given by accident.

   ---- why the preview is a real `<Plate>` ----------------------------------

   Not an `<img>` in a box. The thing being decided here is whether a picture
   works *cut, screened and washed in this building's colours*, and a square
   thumbnail cannot answer that. So the preview is the same component the site
   draws with, fed the object URL of the converted blob, and what is on screen
   before the commit is what lands on the wall after it.
   ========================================================================== */

const KANA_HINT = '接吻 · 朝 · 水 · 密 · 蝶 — one or two characters, lit in the corner of the frame'

type Props = {
  board: Board
  /** Committing is the shell's job — it owns the board and the status line. */
  onPublish: (plate: Uploaded, base64: string) => Promise<void>
  /** False when there is no keyring on this deploy: convert and download, no commit. */
  canCommit: boolean
  busy: boolean
}

export function Intake({ board, onPublish, canCommit, busy }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [maxEdge, setMaxEdge] = useState<number>(1280)
  const [quality, setQuality] = useState(0.86)
  const [shot, setShot] = useState<Converted | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [over, setOver] = useState(false)

  const [id, setId] = useState('')
  const [alt, setAlt] = useState('')
  const [kana, setKana] = useState('')
  const [tone, setTone] = useState<1 | 2 | 3 | 4 | 5>(3)

  const picker = useRef<HTMLInputElement>(null)
  const roster = rosterOf(board)

  /* Re-encode whenever the file or either dial moves. Debounced, because the
     quality slider fires on every pixel of drag and a 12-megapixel re-encode
     per pixel is a locked tab. The cleanup revokes the previous object URL —
     a converted preview is a real blob and dozens of them are real memory. */
  useEffect(() => {
    if (!file) return
    let live = true
    let made: Converted | null = null
    const timer = window.setTimeout(async () => {
      setWorking(true)
      try {
        const next = await convert(file, { maxEdge, quality })
        if (!live) {
          URL.revokeObjectURL(next.preview)
          return
        }
        made = next
        setShot(next)
        setProblem(null)
      } catch (err) {
        if (live) {
          setShot(null)
          setProblem(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (live) setWorking(false)
      }
    }, 160)
    return () => {
      live = false
      window.clearTimeout(timer)
      if (made) URL.revokeObjectURL(made.preview)
    }
  }, [file, maxEdge, quality])

  function take(next: File | null | undefined) {
    if (!next) return
    setFile(next)
    setProblem(null)
    if (!id) setId(slugify(next.name))
  }

  const taken = id ? roster.some((p) => p.id === id) : false
  const badId = id !== '' && !/^[a-z0-9][a-z0-9-]*$/.test(id)
  const ready = !!shot && !!id && !taken && !badId && alt.trim() !== '' && kana.trim() !== ''

  async function publish() {
    if (!shot || !ready) return
    const plate: Uploaded = {
      id,
      file: `${id}.${shot.ext}`,
      w: shot.w,
      h: shot.h,
      alt: alt.trim(),
      kana: kana.trim(),
      tone,
      added: new Date().toISOString().slice(0, 10),
      from: shot.from,
      bytes: shot.bytes,
    }
    await onPublish(plate, await toBase64(shot.blob))
    // The shell reports the commit; this only clears the bench.
    setFile(null)
    setShot(null)
    setId('')
    setAlt('')
    setKana('')
    if (picker.current) picker.current.value = ''
  }

  function download() {
    if (!shot) return
    const a = document.createElement('a')
    a.href = shot.preview
    a.download = `${id || 'plate'}.${shot.ext}`
    a.click()
  }

  return (
    <div className="sl__pane">
      <p className="sl__lede">
        A JPEG or a PNG goes in; a WebP at a stated size comes out and lands in{' '}
        <code>public/art/</code>, with its row in the board committed in the same commit — or a
        JPEG, on a browser with no WebP encoder, named for what it actually is. It is resized and
        re-encoded here and <b>nothing is cropped</b> — the letterbox scans, the signature crops
        and the one real knockout live in <code>scripts/build-art.mjs</code>, which needs a machine
        and is committed beside its output.
      </p>

      {/* ---- the bench ------------------------------------------------- */}
      <div
        className={`sl__drop${over ? ' sl__drop--over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          take(e.dataTransfer.files?.[0])
        }}
      >
        <input
          ref={picker}
          id="sl-file"
          className="sl__file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          onChange={(e) => take(e.target.files?.[0])}
        />
        <label htmlFor="sl-file" className="sl__pick">
          CHOOSE A PICTURE
        </label>
        <span className="sl__drop-note">or drop one here · JPEG, PNG, WebP, GIF, AVIF</span>
      </div>

      {problem && <p className="sl__warn">{problem}</p>}

      {file && (
        <div className="sl__bench">
          {/* ---- the dials ------------------------------------------- */}
          <div className="sl__dials">
            <div className="sl__dial">
              <label className="sl__label" htmlFor="sl-edge">
                LONGEST EDGE
              </label>
              <select
                id="sl-edge"
                className="sl__field"
                value={maxEdge}
                onChange={(e) => setMaxEdge(Number(e.target.value))}
              >
                {EDGES.map((edge) => (
                  <option key={edge} value={edge}>
                    {edge} px
                  </option>
                ))}
              </select>
              <p className="sl__hint">
                Roughly twice the largest box it will sit in. Never upscales: a small clean
                original stays its own size, the way <code>kiss-blush</code> did at 348×345.
              </p>
            </div>

            <div className="sl__dial">
              <label className="sl__label" htmlFor="sl-quality">
                QUALITY · {Math.round(quality * 100)}
              </label>
              <input
                id="sl-quality"
                className="sl__slider"
                type="range"
                min={40}
                max={100}
                step={2}
                value={Math.round(quality * 100)}
                onChange={(e) => setQuality(Number(e.target.value) / 100)}
              />
              <p className="sl__hint">
                The twelve cut plates are ~540 kB for all of them together. Anything over{' '}
                {weigh(HEAVY_BYTES)} is heavy for one.
              </p>
            </div>
          </div>

          {/* ---- what it costs --------------------------------------- */}
          {shot && (
            <dl className="sl__receipts">
              <div>
                <dt>OFF THE MACHINE</dt>
                <dd>
                  {shot.fromW}×{shot.fromH} · {weigh(shot.fromBytes)}
                </dd>
              </div>
              <div>
                <dt>ON THE WALL</dt>
                <dd className={shot.bytes > HEAVY_BYTES ? 'sl__heavy' : undefined}>
                  {shot.w}×{shot.h} · {weigh(shot.bytes)} · {shot.ext.toUpperCase()}
                </dd>
              </div>
              <div>
                <dt>SAVED</dt>
                <dd>
                  {shot.fromBytes > shot.bytes
                    ? `${Math.round((1 - shot.bytes / shot.fromBytes) * 100)}%`
                    : 'nothing — it was already smaller'}
                </dd>
              </div>
              <div>
                <dt>ALPHA CHANNEL</dt>
                <dd>{shot.alpha ? 'yes — it can go on the masthead' : 'no — every pixel opaque'}</dd>
              </div>
            </dl>
          )}
          {shot?.untouched && (
            <p className="sl__hint">
              Already inside {maxEdge} px, so it was re-encoded at its own size and not resized.
            </p>
          )}
          {shot?.fellBack && (
            <p className="sl__caveat">
              This browser has no WebP encoder — iOS Safari is the usual one — so this is a{' '}
              <b>{shot.ext.toUpperCase()}</b>, committed as <code>.{shot.ext}</code> rather than
              mislabelled as <code>.webp</code>. It will be somewhat larger than the rest of the
              folder and everything else about it works the same.{' '}
              {shot.alpha
                ? 'PNG rather than JPEG because the picture has real transparency, and JPEG would fill it with black.'
                : 'Re-do it on a desktop browser if the size matters more than doing it now.'}
            </p>
          )}

          {/* ---- the form -------------------------------------------- */}
          <div className="sl__form">
            <div className="sl__row">
              <label className="sl__label" htmlFor="sl-id">
                ID · THE FILENAME
              </label>
              <input
                id="sl-id"
                className={`sl__field${taken || badId ? ' sl__field--bad' : ''}`}
                value={id}
                onChange={(e) => setId(e.target.value)}
                spellCheck={false}
                autoComplete="off"
              />
              <p className="sl__hint">
                {taken ? (
                  <b>Something is already called that. Two plates cannot share an id.</b>
                ) : badId ? (
                  <b>Lowercase letters, digits and hyphens.</b>
                ) : (
                  <>
                    Lands at <code>public/art/{id || '…'}.{shot?.ext ?? 'webp'}</code>.
                  </>
                )}
              </p>
            </div>

            <div className="sl__row">
              <label className="sl__label" htmlFor="sl-alt">
                ALT TEXT
              </label>
              <textarea
                id="sl-alt"
                className="sl__field sl__field--area"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                rows={3}
              />
              <p className="sl__hint">
                What is in the picture, in a sentence, for somebody who cannot see it. Required —
                on most of these walls the plate is the largest thing on the page.
              </p>
            </div>

            <div className="sl__row sl__row--split">
              <div>
                <label className="sl__label" htmlFor="sl-kana">
                  KANA
                </label>
                <input
                  id="sl-kana"
                  className="sl__field"
                  value={kana}
                  onChange={(e) => setKana(e.target.value)}
                />
                <p className="sl__hint">{KANA_HINT}</p>
              </div>
              <div>
                <label className="sl__label" htmlFor="sl-tone">
                  TONE
                </label>
                <select
                  id="sl-tone"
                  className="sl__field"
                  value={tone}
                  onChange={(e) => setTone(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <p className="sl__hint">
                  Which accent the glow and the wash take. Two of the five palettes collapse the
                  ramp, so treat it as a lean rather than a colour.
                </p>
              </div>
            </div>
          </div>

          {/* ---- the preview ----------------------------------------- */}
          {shot && (
            <figure className="sl__preview">
              <Plate
                plate={{
                  id: id || 'preview',
                  src: shot.preview,
                  w: shot.w,
                  h: shot.h,
                  alt: alt || 'The picture being added, not yet described',
                  kana: kana || '？',
                  tone,
                }}
                cut="torn"
                className="sl__preview-plate"
                eager
              />
              <figcaption className="sl__hint">
                Cut, screened and washed the way the site will draw it — in whichever palette this
                tab is set to. {working && 'Re-encoding…'}
              </figcaption>
            </figure>
          )}

          {/* ---- the button ------------------------------------------ */}
          <div className="sl__actions">
            <button
              type="button"
              className="sl__go"
              disabled={!ready || busy || working || !canCommit}
              onClick={publish}
            >
              {busy ? 'COMMITTING…' : 'COMMIT IT TO THE REPOSITORY'}
            </button>
            <button type="button" className="sl__alt-go" disabled={!shot} onClick={download}>
              DOWNLOAD THE {shot ? shot.ext.toUpperCase() : 'FILE'}
            </button>
          </div>
          {!canCommit && (
            <p className="sl__warn">
              No keyring in this tab, so nothing here can commit. The conversion still works —
              download the file, drop it in <code>public/art/</code>, and add its row to{' '}
              <code>src/content/board.json</code> by hand.
            </p>
          )}
          {ready && canCommit && (
            <p className="sl__hint">
              Committing puts the picture and its row in one commit and asks the site to rebuild.
              It hangs nowhere until you put it on a wall — that is the next tab.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
