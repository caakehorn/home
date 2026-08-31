import { SlateRoom } from '../slates/SlateRoom'

/**
 * THE SLATE ROOM — mounts at /slates.
 *
 * Unlisted in the nav, like /ledger and /blog/write: it is behind the same
 * door as everything else, and the URL is the affordance. A front page that
 * advertises the room where the pictures are chosen is a different object
 * from one that simply has it.
 */
export function SlatesRoute() {
  return <SlateRoom />
}
