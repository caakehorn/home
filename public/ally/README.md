# public/ally — the photographs

Five photographs of Ally Lubin, in a section of their own on the main floor
with the date, the line and a door into the wiki under each one.
`ALLY` in `src/content/art.ts` is the manifest; `<Plate>` draws them like
everything else on the walls.

| file           | what it is | the line |
| -------------- | ---------- | -------- |
| `top8.jpg`     | the 2008 scene internet, the Top 8 | “I peaked in 2008.” |
| `personal.jpg` | the deadpan | “Well I do. It’s personal lol.” |
| `dunkies.jpg`  | the morning of August 19 2026 | “Good morning my queen. What do you want from dunkies?” |
| `cats.jpg`     | the two cats, and the shelf | Sylvia, named like a poet, behaving like a cat. |
| `deal.jpg`     | the night the offer was accepted | “Okay deal. Sounds good 1-2-3 break.” |

## These used to be hidden

They were the payload of the relics: ten stickers scattered across the front
door and the main floor, each opening a panel. Five of the ten had a photograph
behind them; the other five had a drawing.

The hunt is gone and so are the drawings. The photographs and the writing that
went with them are a section now, at a size you can actually see. A hidden thing
that nobody finds is not a thing on the site.

## Adding or replacing one

Unlike the old system there is no filename magic: the manifest is explicit.
Drop the file in, add an entry to `ALLY` in `src/content/art.ts` with its
intrinsic size, and it hangs. Removing one is deleting the file and its entry.

- **Square.** The plate crops with `object-fit: cover`, so anything landscape
  loses its sides. Crop to square first and you decide what survives.
- **Around 800×800.** The picture column is at most 300 px wide on screen.
- **Loud is fine.** These sit on a black page under acid green and violet, and
  the plate already puts a halftone and a wash of the room's own tube over
  whatever it is given. A flash photo taken at 2 AM is the correct register for
  this building; a nicely lit portrait is not.

## One thing worth saying out loud

These are photographs of a real person, on a public site, next to her name and
a stack of dated quotes from a private thread. The wiki material was already
hers to object to and she has read it; a photograph is a different order of
thing from a quote.

The five in here were supplied deliberately. If any one of them turns out to be
the wrong one to have published, deleting the file is the entire retraction —
the relic falls back to its drawing on the next load, nothing else changes, and
no other file mentions it.
