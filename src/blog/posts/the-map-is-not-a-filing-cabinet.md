---
title: THE MAP IS NOT A FILING CABINET
slug: the-map-is-not-a-filing-cabinet
date: 2026-05-14
dek: 458 pages in a card grid is a filing cabinet. The same pages laid out by what they link to is somewhere you can learn your way around.
tags: wiki, design, maps
kana: 地図
tone: 4
---

For two years the wiki index was a grid of cards, alphabetical, with a search
box. It worked in the sense that everything was reachable. It failed in the
sense that I never *browsed* it, not once, in two years. I searched it. There is
a difference, and the difference is the whole reason THE CORTEX exists.

A card grid has no memory. Every visit starts at the same place — the top, in
alphabetical order — and the only way through is to already know what you want.
That is a filing cabinet. Filing cabinets are excellent and I do not want to
live in one.

## Position carries the encoding

So: the same 458 pages, laid out by what they link to. Domains settle into
lobes. The pages that link across everything drift to the middle, which is
exactly where they belong and is not something I told them to do — it falls out
of the force layout, and the first time I saw the six or seven genuinely
connective pages sitting in the centre of the map I understood something about
my own notes that no list had ever shown me.

The layout is baked at sync time by a seeded force run in node, then shipped in
`index.json` with the edge list. Nothing simulates on load. That means **the
wiki is in the same shape every time you walk into it**, which is the entire
mechanism by which a map becomes a place: you cannot learn your way around a
room that rearranges itself when you open the door.

## Colour is state, never identity

This is the decision I argue with people about most, so, in full.

Every page is drawn in one accent. Not nine hues by domain. It brightens for the
page under your cursor and everything it links to, and it recedes for anything
filtered out. That is all colour does here.

A nine-hue rainbow would be unreadable at 458 points, and — the part people miss
— it would also **say less**. Domain is already encoded, better, by position:
the lobes are visibly separate, and a page sitting between two lobes is telling
you something a colour swatch cannot. Spending the colour channel on a fact the
position already carries means having no channel left for the thing that
actually changes, which is what is lit right now.

Searching lights the map rather than emptying it, for the same reason. An empty
map teaches you nothing about where your match sits. A lit one teaches you where
it sits *and* what it is near.

## The probe is the point

Click a star and the panel lists what it connects to — and those are buttons.
You can walk the wiki link by link, page to page, and only actually open one
when you mean it. That is the loop I wanted for two years and did not know how
to ask for: not search, not browse. **Traverse.**

Arrow keys walk between pages, Enter opens, Escape resets, and LIST is the same
set as plain cards for anyone who wants the filing cabinet back. I am not
precious about it. The cabinet was fine. It was just not a place.
