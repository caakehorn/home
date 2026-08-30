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

  /* Always right, never alternating.
     The alternation this used to do was written for a layout where the plate
     had a full-width band to itself, and there left/right made a rhythm down
     the page. It does not survive the plate being pulled up INTO the masthead:
     every masthead on this site is left-aligned, so a left-hand plate lands
     directly on the title — on /brain it covered the words WIKI-BRAIN and the
     page's own stat line. The empty half of a masthead is the right one, and
     that is the only side an overlapping plate can take. Variety comes from
     the cut and the plate instead, which cost nothing legible. */

  return (
    <div className="sec-art sec-art--right" aria-hidden="true">
      <Plate plate={plate} cut={cut} tone={tone} className="sec-art__plate" eager />
    </div>
  )
}
