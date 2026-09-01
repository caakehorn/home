import { SECTIONS } from '../content/sections'
import { draws, hangs } from '../content/slates'
import { Plate, type Cut } from './Plate'
import './section-art.css'

/* ==========================================================================
   THE BANNER — one large plate, on every section's own floor

   The wall on the home page was the only place a picture got to be the
   content rather than the furniture. Everywhere else in the building —
   every named room, the wiki index and every wiki page — opened on nothing
   but type. This is what closes that gap: one plate, large, right under the
   nav, before the room's own masthead says anything.

   ---- which plate, and why it never changes -------------------------------

   Deterministic by name, not random and not by scroll position. Two rules,
   in order:

   1. THE NAMED ROOMS get one plate each, by their fixed position in
      `SECTIONS`. When the counts match exactly, every room's picture is
      distinct from every other room's on the nav bar; a room added after the
      picture count wraps rather than colliding outright, which is honest
      about there being more rooms than pictures rather than pretending
      otherwise.
   2. EVERYTHING ELSE — a wiki page, a blog post, any slug that is not one of
      the named rooms — falls back to a hash of the whole path. There are
      hundreds of wiki pages and a handful of pictures; nothing stops two of
      them landing on the same plate; the hash's only job there is that
      reopening the same page does not reshuffle it.

   ---- and where a person overrules both -----------------------------------

   Both rules are the *default*, not the assignment. `src/content/slates.ts`
   holds a board written from THE SLATE ROOM at /slates: name a plate for a
   room's wall and rule 1 steps aside for that room; name the set of plates a
   pool may draw from and rule 2 hashes over that set instead. An empty board
   is the two rules above, exactly, which is why this file kept them.

   The index still comes from the rules even when the plate does not. It picks
   the cut and the side, and a room reassigned to a different picture should
   change its picture — not slide to the other margin and tear differently.

   ---- why one component instead of copying the void band ------------------

   The home page's wall is a composition — plates overlapping at several
   angles, built for one specific space. That does not scale to a dozen
   routes with a dozen different masthead layouts; copying it that many times
   would be that many places to update the day another plate arrives. This is
   the smaller, repeatable unit: a single torn plate, big, anchored to one
   side, with the room's own kana lit in the corner. It reads as a stamp on a
   document footer more than as a wall — deliberately, since a room's own
   content still has to win the page.

   ---- why the wrapper is not aria-hidden -----------------------------------

   `aria-hidden` on an ancestor removes everything under it from the
   accessibility tree, including the `<img alt>` the `Plate` inside carries.
   Every scene here has a real, specific description — "two women in
   profile, one pink-haired…" — written for exactly this: the largest
   painted object on the page telling a screen reader what is on it. Marking
   the wrapper decorative would throw that away on every single room.
   ========================================================================== */

const CUTS: Cut[] = ['torn', 'shard', 'rip']

type SectionArtProps = {
  /** The section's own slug — `brain`, `sage`, `arcade`, and so on. Anything
      stable works; wiki pages and blog posts pass their own path so entries
      do not all collide on the same plate. */
  slug: string
  tone?: 1 | 2 | 3 | 4 | 5
}

export function SectionArt({ slug, tone }: SectionArtProps) {
  const named = SECTIONS.findIndex((s) => s.slug === slug)
  // Two pools, split on the one prefix that distinguishes them. Everything
  // that reaches here unnamed is either `brain/<page>` or `blog/<post>`; a
  // third kind of path would land in the wiki pool, which is the larger and
  // more general of the two.
  const pooled = named >= 0 ? null : draws(slug.startsWith('blog/') ? 'blog' : 'wiki', slug)
  const i = pooled ? pooled.index : named
  const plate = pooled ? pooled.plate : hangs(`room:${slug}`)
  const cut = CUTS[i % CUTS.length]
  // Alternate sides by index rather than by hash: two adjacent rooms landing
  // on the same side back to back is a coincidence nobody chose, and the
  // alternation reads as a decision the way the void band's angles do.
  const side = i % 2 ? 'right' : 'left'

  return (
    <div className={`sec-art sec-art--${side}`}>
      <Plate plate={plate} cut={cut} tone={tone} className="sec-art__plate" eager />
    </div>
  )
}
