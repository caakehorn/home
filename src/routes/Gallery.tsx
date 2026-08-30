import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Marquee } from '../components/Marquee'
import { Nav } from '../components/Nav'
import { SubHead } from '../components/Wordmark'
import { SectionArt } from '../components/SectionArt'
import { sectionBySlug } from '../content/sections'
import { Lightbox } from '../gallery/Lightbox'
import { Wall } from '../gallery/Wall'
import { albumNote, albumTitle, useGallery, weigh, type Kind } from '../gallery/core'
import '../gallery/gallery.css'

const section = sectionBySlug('gallery')!

type KindFilter = Kind | 'all'

/**
 * THE GALLERY — the room the old repo is hung in.
 *
 * Everything else in this building rebuilt the old work: took its datasets,
 * dropped its chrome, redrew it in this house's own type and colour. That is
 * the right way to inherit a codebase and it loses the one thing a rebuild
 * cannot carry, which is what the original looked like. So this room does not
 * rebuild anything. It photographs.
 *
 * The manifest is not hard-coded — see src/gallery/core.ts. A photograph
 * dropped into public/gallery/media/ and a re-run of `npm run gallery` hangs on
 * the same wall as a plate shot off the old console, and the room does not know
 * or care which is which.
 */
export function GalleryRoute() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, error, loading } = useGallery()
  const [kind, setKind] = useState<KindFilter>('all')
  const [album, setAlbum] = useState<string>('all')

  const shown = useMemo(() => {
    if (!data) return []
    return data.items.filter(
      (p) => (kind === 'all' || p.kind === kind) && (album === 'all' || p.album === album),
    )
  }, [data, kind, album])

  const open = id ? data?.items.find((p) => p.id === id) : undefined

  // A deep link into a picture the current filter hides must still walk
  // somewhere sensible, so the arrows fall back to the whole manifest.
  const neighbours = open && shown.some((p) => p.id === open.id) ? shown : (data?.items ?? [])

  return (
    <div className="gal" style={{ ['--glow' as string]: `var(--n${section.accent})` }}>
      <Nav />
      <Marquee
        text={section.chant}
        duration={22}
        tone={section.accent}
        size="clamp(0.75rem, 1.6vw, 1.05rem)"
      />

      <header className="wrap gal__masthead">
        <h1 className="gal__mast-title">
          <SubHead>THE GALLERY</SubHead>
        </h1>
        <span className="gal__mast-kana jp" aria-hidden="true">
          {section.kana}
        </span>
        <p className="gal__mast-note">{section.blurb}</p>
        <p className="gal__rule">
          <b>WHAT THESE ARE</b> — photographs, not screenshots somebody kept. Every plate on this
          wall was taken by <code>scripts/capture-gallery.mjs</code>, which serves a checkout of the
          old repo, drives a real browser at it and shoots what comes up. Point it at the same
          commit and you get the same pictures. The caption on each one says what it is a picture of
          and what the camera was told to do, for the same reason every instrument in{' '}
          <Link to="/leviathan">LEVIATHAN</Link> owes a method line.
        </p>
        <p className="gal__mast-note gal__mast-note--thin">
          Not everything over there is here. The console's own thirty-seven instruments are behind a
          passphrase this repository does not hold, so what is hung is PHASE 00 and PHASE 01 and the
          pages that were never encrypted. The pages that are nothing but quotation and scoring
          about a named living person are not photographed at all — they are listed, and barred, in
          the rack.
        </p>
      </header>

      <SectionArt slug="gallery" tone={5} />

      {loading && (
        <div className="wrap">
          <p className="gal__state">Opening the room…</p>
        </div>
      )}
      {error && (
        <div className="wrap">
          <p className="gal__state gal__state--bad">The wall is empty: {error}</p>
        </div>
      )}

      {data && (
        <>
          <div className="wrap gal__controls">
            <div className="gal__filter" role="group" aria-label="Kind">
              {(
                [
                  ['all', `ALL ${data.counts.items}`],
                  ['still', `STILLS ${data.counts.stills}`],
                  ['motion', `MOTION ${data.counts.motion}`],
                ] as [KindFilter, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`gal__chip${kind === value ? ' gal__chip--on' : ''}`}
                  aria-pressed={kind === value}
                  onClick={() => setKind(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            {data.albums.length > 1 && (
              <div className="gal__filter" role="group" aria-label="Album">
                <button
                  type="button"
                  className={`gal__chip${album === 'all' ? ' gal__chip--on' : ''}`}
                  aria-pressed={album === 'all'}
                  onClick={() => setAlbum('all')}
                >
                  EVERY ALBUM
                </button>
                {data.albums.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`gal__chip${album === a.id ? ' gal__chip--on' : ''}`}
                    aria-pressed={album === a.id}
                    onClick={() => setAlbum(a.id)}
                  >
                    {albumTitle(a.id)} {a.count}
                  </button>
                ))}
              </div>
            )}

            <p className="gal__tally">
              {shown.length} of {data.counts.items} · {weigh(data.counts.bytes)} on the wall
            </p>
          </div>

          <div className="wrap">
            {album !== 'all' && albumNote(album) && (
              <p className="gal__album-note">{albumNote(album)}</p>
            )}
            {album === 'all' &&
              data.albums.map((a) =>
                albumNote(a.id) ? (
                  <p key={a.id} className="gal__album-note">
                    <b>{albumTitle(a.id)}</b> — {albumNote(a.id)}
                  </p>
                ) : null,
              )}
          </div>

          <div className="wrap">
            <Wall pictures={shown} />
          </div>
        </>
      )}

      {data && id && !open && (
        <div className="wrap">
          <p className="gal__state gal__state--bad">
            No picture called “{id}” hangs here. <Link to="/gallery">Back to the wall.</Link>
          </p>
        </div>
      )}

      {open && (
        <Lightbox picture={open} neighbours={neighbours} onClose={() => navigate('/gallery')} />
      )}
    </div>
  )
}
