import { useEffect, useState } from 'react'

/**
 * THE GALLERY — the core.
 *
 * Every other room in this building is a *reading* of something: the wiki is
 * prose about the record, LEVIATHAN counts it, the lattice draws the family it
 * happened in. This room is the only one that is a *picture* of something —
 * the old repo, photographed running, in its own colours rather than repainted
 * in this house's.
 *
 * The distinction matters more than it sounds. A rebuild is an argument about
 * what the original was for; a photograph is not. LEVIATHAN's rack can tell you
 * that THE CLOCK was a spiral of eleven years of messages, and it can tell you
 * honestly that this house has not built it. Only the photograph can show you
 * that the thing was beautiful.
 *
 * ---- the manifest --------------------------------------------------------
 *
 * Nothing about the wall is hard-coded. `public/gallery/index.json` is written
 * by `npm run gallery`, which walks `public/gallery/media/` and reads a sidecar
 * beside each file. Drop a photograph in, re-run it, and the room has it — no
 * component knows the difference between a plate shot off the old repo and a
 * picture somebody took on a phone.
 */

export type Kind = 'still' | 'motion'

export type Picture = {
  /** From the filename, and the deep link: /gallery/the-gravity-well. */
  id: string
  /** The directory it sits in. */
  album: string
  kind: Kind
  title: string
  kana?: string
  caption?: string
  /** What in the old repo this is a picture of. */
  source?: string
  /** What the camera was told to do. Every plate owes this, like a method line. */
  shot?: string
  src: string
  /** Motion only: the frame the card shows at rest. */
  poster?: string
  /** Intrinsic size, so a card can be laid out before its picture lands. */
  w: number
  h: number
  bytes: number
}

export type Album = { id: string; count: number }

export type Manifest = {
  generatedAt: string
  counts: { items: number; stills: number; motion: number; bytes: number }
  albums: Album[]
  items: Picture[]
}

/**
 * The manifest is small; the media is not. Nothing here preloads a picture —
 * the grid hands every <img> and <video> `loading="lazy"` / `preload="none"`
 * and lets the browser decide, which is the whole reason the cards carry
 * intrinsic dimensions.
 */
const url = (path: string) => `${import.meta.env.BASE_URL}${path}`.replace(/\/{2,}/g, '/')

/** A manifest path is absolute from the site root; BASE_URL re-roots it for a subpath deploy. */
export const asset = (src: string) => url(src.replace(/^\//, ''))

let pending: Promise<Manifest> | null = null

export function loadManifest(): Promise<Manifest> {
  if (!pending) {
    pending = fetch(url('gallery/index.json')).then((r) => {
      if (!r.ok) throw new Error(`the gallery manifest is not there (${r.status}) — run \`npm run gallery\``)
      return r.json() as Promise<Manifest>
    })
  }
  return pending
}

type Async = { data: Manifest | null; error: string | null; loading: boolean }

export function useGallery(): Async {
  const [state, setState] = useState<Async>({ data: null, error: null, loading: true })
  useEffect(() => {
    let live = true
    loadManifest()
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((e: Error) => live && setState({ data: null, error: e.message, loading: false }))
    return () => {
      live = false
    }
  }, [])
  return state
}

/** Album ids are directory names; the wall wants them shoutable. */
export const albumTitle = (id: string) =>
  ({ leviathan: 'THE OLD REPO', unfiled: 'UNFILED' })[id] ?? id.replace(/[-_]+/g, ' ').toUpperCase()

export const albumNote = (id: string) =>
  ({
    leviathan:
      'VOID + LEVIATHAN, photographed running. Every plate here was shot off a checkout of caakehorn/leviathan by scripts/capture-gallery.mjs, which is in this repository and can be pointed at the same commit again.',
  })[id] ?? ''

const KB = 1024

export const weigh = (bytes: number) =>
  bytes >= KB * KB ? `${(bytes / (KB * KB)).toFixed(1)} MB` : `${Math.round(bytes / KB)} KB`
