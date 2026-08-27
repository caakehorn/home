import { SCENE_ORDER, sceneById } from '../content/art'
import { SECTIONS } from '../content/sections'
import { Plate, type Cut } from './Plate'
import './section-art.css'

/* ==========================================================================
   THE BANNER — one large plate, on every section's own floor

   The wall on the home page was the only place a picture got to be the
   content rather than the furniture. Everywhere else in the building — eight
   section routes, the wiki index and every wiki page — opened on nothing but
   type. This is what closes that gap: one plate, large, right under the nav,
   before the room's own masthead says anything.

   ---- which plate, and why it never changes -------------------------------

   Deterministic by name, not random and not by scroll position. Two rules,
   in order:

   1. THE EIGHT NAMED ROOMS get one scene each, by their fixed position in
      `SECTIONS` — there are exactly eight of both, so every room's picture is
      distinct from every other room's on the nav bar, with no coincidence of
      two adjacent doors opening on the same face. A ninth section extends
      this by wrapping rather than colliding, until a ninth scene exists to
      give it its own.
   2. EVERYTHING ELSE — a wiki page, a blog post, any slug that is not one of
      the eight — falls back to a hash of the whole path. There are 486 wiki
      pages and eight pictures; nothing stops two of them from landing on the
      same plate; the hash's only job there is that reopening the same page
      does not reshuffle it.

   ---- why one component instead of copying the void band ------------------

   The home page's wall is a composition — three plates overlapping at three
   angles, built for one specific space. That does not scale to ten routes
   with ten different masthead layouts; copying it ten times would be ten
   places to update the day an eleventh plate arrives. This is the smaller,
   repeatable unit: a single torn plate, big, anchored to one side, with the
   room's own kana lit in the corner. It reads as a stamp on a document footer
   more than as a wall — deliberately, since a room's own content still has to
   win the page.
   ========================================================================== */

const CUTS: Cut[] = ['torn', 'shard', 'rip']

function hash(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0
  return Math.abs(h)
}

type SectionArtProps = {
  /** The section's own slug — `brain`, `sage`, `arcade`, and so on. Anything
      stable works; wiki pages pass their own path so long entries and short
      ones do not all collide on the same plate. */
  slug: string
  tone?: 1 | 2 | 3 | 4 | 5
}

export function SectionArt({ slug, tone }: SectionArtProps) {
  const named = SECTIONS.findIndex((s) => s.slug === slug)
  const i = named >= 0 ? named % SCENE_ORDER.length : hash(slug) % SCENE_ORDER.length
  const plate = sceneById(SCENE_ORDER[i])
  const cut = CUTS[i % CUTS.length]
  // Alternate sides by index rather than by hash: two adjacent sections
  // landing on the same side back to back is a coincidence nobody chose, and
  // the alternation reads as a decision the way the void band's angles do.
  const side = i % 2 ? 'right' : 'left'

  return (
    <div className={`sec-art sec-art--${side}`}>
      <Plate plate={plate} cut={cut} tone={tone} className="sec-art__plate" eager />
    </div>
  )
}
