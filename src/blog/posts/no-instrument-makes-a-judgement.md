---
title: NO INSTRUMENT MAKES A JUDGEMENT
slug: no-instrument-makes-a-judgement
date: 2026-06-30
dek: Every number in LEVIATHAN is a count, a date or a length — and the moment one of them was a score, the whole rack became a portrait of an argument instead of a portrait of the thing.
tags: leviathan, data, method
kana: 巨獣
tone: 1
---

The rule came out of the old repo and it survived the port unchanged, which is
more than most of the code did:

> **No instrument makes a judgement.** Every number is a count, a date or a
> length, taken over the whole corpus with nothing excluded and nothing weighted.

No sentiment scoring. No keyword lists. No threshold picked because of what it
would surface. It sounds like modesty. It is not — it is the only thing standing
between a visualiser and a very expensive way of agreeing with yourself.

## How I learned it

The first version of THE MASS had a "heat" score. Words per page, times link
density, times a recency weight, normalised. It produced a beautiful chart. The
chart said the heaviest thing in the corpus was a cluster of pages I had written
in one week in 2019.

I believed it for about a day. Then I noticed the recency weight had a half-life
I had picked by *eye*, because the first value made the chart look flat. I had
tuned a parameter until the output was interesting. That is not analysis. That
is drawing the conclusion and then finding the coefficient that produces it, and
the fact that I did it in a fit of enthusiasm rather than dishonesty made it
worse, not better, because I would not have caught it if the number had been
less flattering.

Every editorial knob is one of these waiting to happen. So the knobs are gone.

## What the constraint buys

It turns out that counting, done over everything with nothing excluded, is
strange enough on its own.

**THE CHRONOLOGY** mines every date the wiki names out of its own prose — not
off the timeline pages, out of the sentences — and bins them by year from 1900
to 2026. What it draws is not when things happened. It is **when the record says
things happened**, which is a different object and a more honest one: the
spikes are not events, they are attention. There is a wall in 2017 that
corresponds to nothing that happened in 2017 and everything about the year I sat
down and wrote 2017 up.

A sentiment model would never have shown me that. It would have shown me a mood.

**THE MASS** is nine domains by word count, a page-length distribution, and the
heaviest pages. That is it. It took me a week to accept that this was finished,
because it felt like it needed an insight bolted on. It does not. Where the
weight sits *is* the insight, and it is one I got wrong when I guessed.

## The part that is not modesty

There is one thing an instrument must always do, and the frame enforces it:
every one of them states, on its face and never optionally, **how it got its
numbers**. Corpus, method, exclusions — of which there are none, which is itself
a statement.

An instrument that cannot say how it got its numbers has no business being read.
That is not a style rule for this site. I think it is close to the whole of data
ethics for personal projects, and the reason nobody follows it is that the
honest method line is usually the most boring sentence on the page and it makes
the chart look smaller.

Let it look smaller. A count you can check beats an insight you have to trust.
