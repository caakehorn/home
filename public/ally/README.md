# public/ally — the relic photographs

Ten Easter eggs are scattered across the front door and the main floor, each
one a real thing out of the record. Every one of them will show a photograph
the moment there is a photograph to show, and until then it shows a drawing.

## Dropping a photograph in

Name the file for the relic's id and put it in this folder. That is the whole
procedure — no manifest to edit, no import to add, no code change. The panel
picks it up the next time that relic is opened.

| file                | relic                | where it hides | what it is | state |
| ------------------- | -------------------- | -------------- | ---------- | ----- |
| `top8.jpg`          | THE HANDLE           | front door     | `aluuuu`, the 2008 scene internet, the Top 8 | **photo** |
| `personal.jpg`      | IT’S PERSONAL LOL    | front door     | October 30 2023, the sharpest sentence in the file | **photo** |
| `dunkies.jpg`       | THE FIRST MORNING    | main floor     | “Good morning my queen. What do you want from dunkies?” | **photo** |
| `cats.jpg`          | EDGAR & SYLVIA       | main floor     | the two cats, and the shelf | **photo** |
| `deal.jpg`          | THE OFFER, ACCEPTED  | main floor     | “Okay deal. Sounds good 1-2-3 break.” | **photo** |
| `petey.jpg`         | THE FIRST REPLY      | front door     | “Ok PeteyxWentz” — August 18 2026, 1:46 PM | drawn |
| `cancer.jpg`        | A CANCER SUN         | front door     | June 26 1990 — cardinal water, ruled by the moon | drawn |
| `necklace.jpg`      | THE CATBIRD NECKLACE | main floor     | “Get me this for being brave.” | drawn |
| `ledger.jpg`        | THE FINDER’S FEE     | main floor     | $25.00, December 12 2018, 4:11:43 AM | drawn |
| `enfp.jpg`          | ENFP                 | main floor     | the argument that is still open | drawn |

Five are photographs and five are drawings, and that split is not a
half-finished job. The five drawn ones are the object relics — a message
bubble, a constellation, a necklace, a receipt, four boxes with a letter in
each — and a portrait would say less about any of them than the drawing does.
The five photographed ones are the ones that are about *her being in the room*:
the cat ears, the deadpan, the morning, the glam, and the one that is visibly
from the older internet.

`.jpg`, `.png` and `.webp` all work; they are tried in that order and the
drawing is what happens when none of them is there. Anything that is not one
of those ten names is ignored.

## What to give it

- **Square.** The plate is `aspect-ratio: 1` and crops with `object-fit: cover`,
  so anything landscape loses its sides and anything portrait loses its top.
  Crop to square first and you decide what survives instead of the CSS deciding.
- **Around 800×800.** The plate is at most ~8rem wide on screen. A 4000px phone
  photo is roughly twenty times more image than the largest display will use,
  and it is fetched over the wire on the click.
- **Loud is fine.** These sit on a black page under acid green and violet, and
  the plate already puts a notch of contrast and a wash of the relic's own tube
  over whatever it is given. A flash photo taken at 2 AM is the correct register
  for this building; a nicely lit portrait is not.

## One thing worth saying out loud

These are photographs of a real person, on a public site, next to her name and
a stack of dated quotes from a private thread. The wiki material was already
hers to object to and she has read it; a photograph is a different order of
thing from a quote.

The five in here were supplied deliberately. If any one of them turns out to be
the wrong one to have published, deleting the file is the entire retraction —
the relic falls back to its drawing on the next load, nothing else changes, and
no other file mentions it.
