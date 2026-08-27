import { SCENE_ORDER, sceneById } from '../content/art'
import { SECTIONS } from '../content/sections'
import { Plate, type Cut } from './Plate'
import './section-art.css'

/* One deterministic plate per named room; everything else hashes its stable path. */
const CUTS: Cut[] = ['torn', 'shard', 'rip']

function hash(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0
  return Math.abs(h)
}

type SectionArtProps = {
  /** Named section slug, or a stable full path for pages such as /brain/foo. */
  slug: string
  tone?: 1 | 2 | 3 | 4 | 5
}

export function SectionArt({ slug, tone }: SectionArtProps) {
  const named = SECTIONS.findIndex((s) => s.slug === slug)
  const i = named >= 0 ? named % SCENE_ORDER.length : hash(slug) % SCENE_ORDER.length
  const plate = sceneById(SCENE_ORDER[i])
  const cut = CUTS[i % CUTS.length]
  const side = i % 2 ? 'right' : 'left'

  return (
    <div className={`sec-art sec-art--${side}`} aria-hidden="true">
      <Plate plate={plate} cut={cut} tone={tone} className="sec-art__plate" eager />
    </div>
  )
}
