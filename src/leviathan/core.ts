import { useEffect, useState } from 'react'

/**
 * LEVIATHAN — the core.
 *
 * The old site was thirty-seven instruments over two sections, each one a
 * hand-wired page that loaded its own payload and drew its own chrome. This is
 * the rack they get rebuilt into: a registry that says what an instrument is,
 * a loader that hands it a dataset, and a frame that gives every one of them
 * the same header, the same method note and the same source line.
 *
 * THE RULE comes across from the original unchanged, and it is the reason the
 * wing is worth building rather than just pretty: **no instrument makes a
 * judgement.** Every number is a count, a date or a length, taken over the
 * whole corpus with nothing excluded and nothing weighted. No sentiment
 * scoring, no keyword lists, no threshold chosen for what it would surface.
 * Anything editorial would make the output a portrait of an argument; left
 * alone, the counts make a portrait of the thing itself.
 */

/**
 * The whole old console is in this list — all thirty-seven of it, both
 * sections, plus the three the house built afterwards. That is deliberate and
 * it is the point of the five statuses below: a rack that only lists what is
 * finished is a showreel, and a showreel cannot tell you what is missing.
 * Listing every instrument and saying, next to each one, exactly why it is or
 * is not lit turns the same page into a map.
 */
export type InstrumentStatus =
  /** Built here, wired to a dataset that ships with the site. */
  | 'LIVE'
  /**
   * It came across, under this house's own name and in another room. The entry
   * stays in its old wing so the old console can be read off this page whole,
   * and points at wherever the thing it became actually lives.
   */
  | 'PORTED'
  /** The corpus it reads already ships here. Nobody has built the instrument. */
  | 'UNBUILT'
  /** Declared, and waiting on a corpus this site does not carry. */
  | 'SEALED'
  /**
   * It exists over there and it does not come across, because it makes a
   * judgement — a keyword list, a sentiment score, a composite index — and
   * THE RULE forbids one. Not a to-do. A decision, with its reason attached.
   */
  | 'BARRED'

/**
 * The old console had two sections, `◈ CORPUS` and `◈ WIKI`, sharing one tab
 * bar. They are kept as wings rather than flattened, because which corpus an
 * instrument reads is the first thing worth knowing about it.
 */
export type Wing =
  /** Nineteen instruments over the message record. */
  | 'CORPUS'
  /** Eighteen over the second brain. */
  | 'WIKI'
  /** Six on the unlisted third page, all of them scoring. */
  | 'PROCUREMENT'
  /** Built in this building, with no counterpart over there. */
  | 'HOUSE'

export type Instrument = {
  id: string
  /** Instruments are numbered in the old house style, restarting per wing. */
  numeral: string
  title: string
  kana: string
  wing: Wing
  /** What it is computed over. */
  corpus: string
  blurb: string
  /** How the numbers were arrived at, in one sentence. Every instrument owes this. */
  method: string
  status: InstrumentStatus
  /** Where it came from in the old repo, so the port can be checked against it. */
  origin?: string
  /** For SEALED and UNBUILT entries: what would have to arrive for it to light up. */
  needs?: string
  /** For BARRED entries: which part of THE RULE it breaks. */
  bars?: string
  /** For PORTED entries: the route it came across as. */
  portedTo?: string
}

/** THE RULE, in the one sentence a BARRED instrument gets told it broke. */
const JUDGEMENT = (what: string) =>
  `${what} That is a judgement, not a count, and THE RULE does not bend for an instrument that looks good.`

export const INSTRUMENTS: Instrument[] = [
  // -------------------------------------------------------------------------
  // THE HOUSE — built here. Four of these, and they are the only four.

  {
    id: 'mass',
    numeral: 'I',
    title: 'THE MASS',
    kana: '質量',
    wing: 'HOUSE',
    corpus: '486 wiki pages · 630,514 words',
    blurb: 'Where the weight actually sits. Nine domains, by how much has been written in them.',
    method: 'Word counts per page, summed by domain. Nothing weighted, nothing excluded.',
    status: 'LIVE',
    origin: 'the console’s WIKI 08 · MASS, rebuilt over this snapshot',
  },
  {
    id: 'chronology',
    numeral: 'II',
    title: 'THE CHRONOLOGY',
    kana: '年代',
    wing: 'HOUSE',
    corpus: '4,987 dated mentions · 1900 → 2026',
    blurb:
      'Every date the wiki names, mined out of its own prose — not the timeline pages, the whole corpus. Where the record thickens, and where it goes quiet.',
    method:
      'Dates parsed from page bodies by the same matchers the brief visualiser uses, counted once per page per distinct date.',
    status: 'LIVE',
    origin: 'no counterpart over there — this one is the house’s',
  },
  {
    id: 'pen',
    numeral: 'III',
    title: 'THE PEN',
    kana: '筆',
    wing: 'HOUSE',
    corpus: '4,987 dated mentions · 1900 → 2026',
    blurb:
      'The chart recorder from the old console, with the lanes finally carrying something. Four counts against one axis, traced by a stylus that sits where the value is.',
    method:
      'Per year: mentions landing in it, distinct pages naming it, distinct domains among those pages, and pages whose earliest named date it is. Each lane scaled to its own maximum, which is printed beside it.',
    status: 'LIVE',
    origin: 'js/pen-core.js — the scaffold POLYGRAPH, WEATHER, EPISTEME and CRUCIBLE all composed',
  },
  {
    id: 'accretion',
    numeral: 'IV',
    title: 'THE ACCRETION',
    kana: '堆積',
    wing: 'HOUSE',
    corpus: '147 commits · 36 days · 8 → 460 pages',
    blurb:
      'The wiki being built, plotted against real time. Four counts on one axis — and they disagree, which is the whole reading: the corpus arrived in a day and then deepened for five weeks.',
    method:
      'Per first-parent commit: files under wiki/ ending .md, the sum of their blob sizes, every [[wiki/…]] occurrence, and distinct page→page pairs. Read from git rather than the snapshot, since the snapshot only knows the present. Nothing smoothed, no commit excluded.',
    status: 'LIVE',
    origin: 'the console’s WIKI 06 · ACCRETION, rebuilt off git instead of a build log',
  },

  // -------------------------------------------------------------------------
  // ◈ CORPUS — nineteen instruments over the message record.
  //
  // Ten of them are BARRED, and that is not an accident of what shipped: the
  // corpus half of the old console was largely built out of rhetorical
  // scoring, and rhetorical scoring is exactly the thing THE RULE was written
  // against. They are listed anyway. A rack that quietly dropped them would be
  // making the same claim about the old site that a highlight reel makes.

  {
    id: 'pulse',
    numeral: 'I',
    title: 'THE PULSE',
    kana: '脈',
    wing: 'CORPUS',
    corpus: '134,348 messages · 3,894 days · 91 of 129 months covered',
    blurb:
      'The whole record as one line you can throw — every day a bar, 3,894 of them, and the months the archive is missing hatched where they really fall.',
    method:
      'Messages per day over every day in the span, drawn as one bar each on a window you can drag and zoom. The 38 months the exports do not cover are hatched at their real width rather than drawn as silence.',
    status: 'LIVE',
    origin:
      'void.html · MODULE 01 · draw_pulse — minus the four hand-drawn era bands, which were chosen rather than counted',
  },
  {
    id: 'clock',
    numeral: 'II',
    title: 'THE CLOCK',
    kana: '時計',
    wing: 'CORPUS',
    corpus: '134,348 messages · 3,894 days · 2015-11-28 → 2026-07-26',
    blurb: 'Every message placed by when it was sent. Angle is the hour, radius is the date.',
    method: 'Timestamps read from the string, never through Date(), so no timezone can move an hour.',
    status: 'LIVE',
    origin: 'void.html · MODULE 02 · draw_clock — and again, standalone, as clock.html, which is photographed in THE GALLERY',
  },
  {
    id: 'orbits',
    numeral: 'III',
    title: 'THE ORBITS',
    kana: '軌道',
    wing: 'CORPUS',
    corpus: 'every thread in the message record',
    blurb:
      'One body per correspondent, orbiting by how recently they were spoken to — talked yesterday at the centre, silent for a decade out at the rim. You can fling them.',
    method: 'Days since the last message, and messages exchanged. Two counts, one of them a subtraction of dates.',
    status: 'SEALED',
    origin: 'void.html · MODULE 03 · draw_orbits',
    needs:
      'the multi-thread export. THE TRANSCRIPT ships one thread; this instrument is about all the others, and they are not vendored here',
  },
  {
    id: 'atlas',
    numeral: 'IV',
    title: 'THE ATLAS',
    kana: '地図',
    wing: 'CORPUS',
    corpus: '6,185 location fixes',
    blurb:
      'A decade of movement replayed over the north-east corridor, rivers and interstates drawn in by hand. Play it at ×1, ×4 or ×12 and watch a life move between two states.',
    method: 'Each fix placed at its own coordinates on its own date. No path is interpolated between two of them.',
    status: 'SEALED',
    origin: 'void.html · MODULE 04 · draw_atlas',
    needs: 'the location history, which is not vendored here and is not something this site is going to publish',
  },
  {
    id: 'lexicon',
    numeral: 'V',
    title: 'THE LEXICON',
    kana: '語彙',
    wing: 'CORPUS',
    corpus: '134,348 messages · 965,583 words · 19,873 distinct',
    blurb:
      'The vocabulary as physics — every word a body, sized by how often it is used, with a seismograph of shouting under it.',
    method:
      'Every run of letters in every message, lowercased and counted; and the share of messages with three letters or more and no lowercase letter in them. Both are counts. The one filter is a closed-class stoplist, which ships inside the dataset and is printed in full on the instrument beside the unfiltered table.',
    status: 'LIVE',
    origin: 'void.html · MODULE 05 · draw_lexicon — the physics word cloud becomes a ranked table, because a cloud makes size hard to read and this owes exact counts',
  },
  {
    id: 'shelf',
    numeral: 'VI',
    title: 'THE SHELF',
    kana: '棚',
    wing: 'CORPUS',
    corpus: '1,121 rated works',
    blurb:
      'Music, books, films, art — everything ever rated, against what everybody else rated it. The diagonal is perfect agreement with the world and almost nothing sits on it.',
    method: 'Two ratings per work, his and the aggregate, plotted against each other. Neither is adjusted.',
    status: 'SEALED',
    origin: 'void.html · MODULE 06 · draw_shelf',
    needs: 'the ratings export, which is not vendored here',
  },
  {
    id: 'weather',
    numeral: 'VII',
    title: 'THE WEATHER',
    kana: '天気',
    wing: 'CORPUS',
    corpus: 'the message record joined to a weather series',
    blurb:
      'Real weather — cold, precipitation, travel — run underneath the record as four pens, with a needle you can drag through eleven years.',
    method: 'Weekly weather observations joined to the record by date, against rhetorical rates per 100 messages.',
    status: 'BARRED',
    origin: 'void.html · MODULE 07 · draw_weather / draw_weatherStorm',
    bars: JUDGEMENT('The pens are LOVE, PROFANITY, APOLOGY, HEDGING, COMMAND and SHOUT — six keyword lists asked to stand in for a mood, and then correlated against the sky.'),
  },
  {
    id: 'polygraph',
    numeral: 'VIII',
    title: 'THE POLYGRAPH',
    kana: '探知',
    wing: 'CORPUS',
    corpus: '181,650 messages · every thread',
    blurb: 'The four-pen chart recorder, run over the whole record rather than one thread, with the fragments that moved each pen printed beside it verbatim.',
    method: 'Rates per 100 messages per month on four channels, against a volume lane.',
    status: 'BARRED',
    origin: 'void.html · MODULE 08 · draw_annie',
    bars: JUDGEMENT('The four pens are LOVE, PROFANITY, APOLOGY and SHOUT. The instrument is beautiful and the pens are keyword lists.'),
  },
  {
    id: 'signal',
    numeral: 'IX',
    title: 'THE SIGNAL',
    kana: '電波',
    wing: 'CORPUS',
    corpus: '12,863 YouTube watches',
    blurb: 'A decade of listening as a spectrogram, with a tuner that walks the artists one at a time.',
    method: 'Watches per artist per day. A count, binned by date.',
    status: 'SEALED',
    origin: 'void.html · MODULE 09 · draw_signal',
    needs: 'the watch history, which is not vendored here',
  },
  {
    id: 'mirror',
    numeral: 'X',
    title: 'THE MIRROR',
    kana: '鏡',
    wing: 'CORPUS',
    corpus: 'every thread in the message record',
    blurb: 'How he writes changes depending on who he is writing to. One point per correspondent, against the median of all of them.',
    method: 'Affection and hedges per 100 sent messages, per thread.',
    status: 'BARRED',
    origin: 'void.html · MODULE 10 · draw_mirror',
    bars: JUDGEMENT('“Affection per 100 sent” is a keyword list with a rate sign after it, and the instrument’s whole claim is a reading of what that rate means about a person.'),
  },
  {
    id: 'gravity',
    numeral: 'XI',
    title: 'THE GRAVITY',
    kana: '引力',
    wing: 'CORPUS',
    corpus: 'every thread in the message record',
    blurb: 'Which people pull the same language out of him, clustered by how alike the writing gets around them.',
    method: 'Rhetorical rate vectors per thread, clustered by distance between them.',
    status: 'BARRED',
    origin: 'void.html · MODULE 11 · draw_gravity',
    bars: JUDGEMENT('Every axis of the space it clusters in is a keyword rate, so the clusters are groupings of a scoring choice.'),
  },
  {
    id: 'forensic',
    numeral: 'XII',
    title: 'THE FORENSIC',
    kana: '鑑識',
    wing: 'CORPUS',
    corpus: 'the message record, daily',
    blurb: 'Four composite scores per day, each one clickable through to the messages that produced it.',
    method: 'Four weighted indices over daily message text, with the top-scoring fragments pinned as evidence.',
    status: 'BARRED',
    origin: 'void.html · MODULE 12 · draw_forensic',
    bars: JUDGEMENT('The four scores are PLEADING, APOLOGY, LOVE-BOMB and DENIAL. Naming a day’s messages “love-bomb” is a verdict about a person, computed.'),
  },
  {
    id: 'rings',
    numeral: 'XIII',
    title: 'THE RINGS',
    kana: '年輪',
    wing: 'CORPUS',
    corpus: '134,348 messages · 3,893 days',
    blurb: 'Sixteen years coiled into circles, one ring per year, one mark per day. A silent day is a gap you can see from across the room.',
    method:
      'Messages per day wrapped onto one ring per year, January at the top. A count and a date. Days inside a month the exports do not cover are drawn hollow rather than left empty.',
    status: 'LIVE',
    origin: 'void.html · MODULE 13 · draw_rings',
  },
  {
    id: 'silence',
    numeral: 'XIV',
    title: 'THE SILENCE',
    kana: '沈黙',
    wing: 'CORPUS',
    corpus: '134,348 messages · 129 months, 91 of them covered',
    blurb:
      'The negative space of the record: every gap, how long it ran, and the line that ended it — with the holes in the archive kept out of the ranking, because a missing export is not a silence.',
    method:
      'Elapsed time between consecutive messages, ranked. Nothing about a gap is inferred beyond its length and its two ends, and the message that ended one is cited by line number rather than quoted. Gaps that span a month the exports do not cover are listed apart, because a hole in an archive is not a silence.',
    status: 'LIVE',
    origin: 'void.html · MODULE 14 · draw_silence',
  },
  {
    id: 'psyche',
    numeral: 'XV',
    title: 'THE PSYCHE',
    kana: '精神',
    wing: 'CORPUS',
    corpus: '56 rated works × the language around them',
    blurb: 'What was being listened to and read in the fortnights that read profane, tender, charged both ways, or quiet.',
    method: 'Works rated within a window, cross-tabulated against that window’s rhetorical channels.',
    status: 'BARRED',
    origin: 'void.html · MODULE 15 · draw_psyche',
    bars: JUDGEMENT('PROFANE, TENDER, CHARGED BOTH WAYS and QUIET are four buckets somebody chose, and then a taste is explained by them.'),
  },
  {
    id: 'sync',
    numeral: 'XVI',
    title: 'THE SYNC',
    kana: '同調',
    wing: 'CORPUS',
    corpus: 'every thread in the message record',
    blurb: 'Linguistic style matching, him against each of them, over ten channels — first person, hedges, commands, questions, all-caps and the rest.',
    method: 'Per-channel rate difference between the two sides of a thread, combined into one match score.',
    status: 'BARRED',
    origin: 'void.html · MODULE 16 · draw_sync',
    bars: JUDGEMENT('Ten channels are ten keyword lists, and a single “style match” number on top of them is a composite index.'),
  },
  {
    id: 'drift',
    numeral: 'XVII',
    title: 'THE DRIFT',
    kana: '漂流',
    wing: 'CORPUS',
    corpus: 'the message record, monthly',
    blurb: 'Every month against every other month, shaded by how much the writing sounds the same. The diagonal is a year of a voice changing.',
    method: 'Cosine similarity between months over eight rhetorical rates.',
    status: 'BARRED',
    origin: 'void.html · MODULE 17 · draw_drift',
    bars: JUDGEMENT('The similarity is computed in a space whose eight axes are keyword rates, so “sounds like” means “scores like”.'),
  },
  {
    id: 'oracle',
    numeral: 'XVIII',
    title: 'THE ORACLE',
    kana: '神託',
    wing: 'CORPUS',
    corpus: '181,650 messages · every thread',
    blurb: 'The same six channels as a rotating radar rather than parallel lanes — one hexagon per month, with a ghosted trail of the months behind it.',
    method: 'Six rhetorical rates per month, drawn as a radar polygon.',
    status: 'BARRED',
    origin: 'void.html · MODULE 18 · draw_oracle',
    bars: JUDGEMENT('LOVE, APOLOGY, HEDGE, COMMAND, PROFANITY and SHOUT are the six spokes. Rotating them does not make them counts.'),
  },
  {
    id: 'authority',
    numeral: 'XIX',
    title: 'THE AUTHORITY',
    kana: '権威',
    wing: 'CORPUS',
    corpus: '181,650 messages · every thread',
    blurb: 'Command against hedge, monthly, with a diverging lane between them that reads ASSERTING above the line and DEFERRING below it.',
    method: 'Two rates per 100 messages per month, and their difference.',
    status: 'BARRED',
    origin: 'void.html · MODULE 19 · draw_authority',
    bars: JUDGEMENT('It prints a verdict on a month — asserting or deferring — off two keyword lists.'),
  },

  // -------------------------------------------------------------------------
  // ◈ WIKI — eighteen over the second brain.
  //
  // This is the wing where the port is nearly free: the corpus these read is
  // the snapshot at /brain, which ships. Sixteen of them are UNBUILT rather
  // than SEALED, and that list is the honest to-do.

  {
    id: 'reader',
    numeral: 'I',
    title: 'THE READER',
    kana: '読解',
    wing: 'WIKI',
    corpus: '486 pages · 630,514 words · nine domains',
    blurb: 'The prose itself, searchable, with the typed links resolved. The one instrument that is not a reading of the corpus but the corpus.',
    method: 'Markdown rendered as written. Nothing summarised, nothing reordered.',
    status: 'PORTED',
    origin: 'wiki.html · js/wiki-reader.js',
    portedTo: '/brain',
  },
  {
    id: 'web',
    numeral: 'II',
    title: 'THE WEB',
    kana: '網',
    wing: 'WIKI',
    corpus: '486 pages · 3,536 links',
    blurb: 'The entire second brain as one graph — every page a node, every link an edge, nothing pinned and nothing hidden.',
    method:
      'Every link one page makes to another, drawn as an edge. Node colour is the domain and node size is the word count, square-rooted so a 20,000-word page is not forty times the area of a 500-word one. The coordinates are the ones the map at /brain computed, not a simulation run here — the edges are the data and the layout is a drawing decision made once.',
    status: 'LIVE',
    origin: 'js/wiki-modules.js · WIKI 02 · draw_web',
  },
  {
    id: 'claims',
    numeral: 'III',
    title: 'THE CLAIMS',
    kana: '主張',
    wing: 'WIKI',
    corpus: '689 sentences that name another page',
    blurb: 'The links read back as what they are — one page saying something about another, printed whole, in the wiki’s own words.',
    method:
      'Every sentence of prose that names another page, printed whole with both ends linked. Table rows, headings and lists of bare links are not sentences and are not here. Nothing is ranked — the feed is in page order, and the only filters are the ones the reader turns on.',
    status: 'LIVE',
    origin:
      'js/wiki-modules.js · WIKI 03 · draw_claims — minus the edge types, which this snapshot does not carry and which are not invented here',
  },
  {
    id: 'census',
    numeral: 'IV',
    title: 'THE CENSUS',
    kana: '戸籍',
    wing: 'WIKI',
    corpus: '117 spans of 165 people pages',
    blurb: 'Every documented person the wiki gives a span to, as a line on one axis — and a count of the 48 it does not.',
    method:
      'The date range each page gives for its own record — date_range_start to date_range_end — drawn as a line on one axis. It is the span of the documentation, not a lifetime. A page with no dates gets no line rather than an invented one, and an open range is drawn open rather than capped at a guess.',
    status: 'LIVE',
    origin: 'js/wiki-modules.js · WIKI 04 · draw_census',
  },
  {
    id: 'strata',
    numeral: 'V',
    title: 'THE STRATA',
    kana: '地層',
    wing: 'WIKI',
    corpus: '4,987 dated mentions · 1900 → 2026',
    blurb: 'What the wiki knows, plotted in time and stacked by domain — the record as sediment.',
    method: 'Dated mentions binned by year and domain. A count and a date.',
    status: 'PORTED',
    origin: 'js/wiki-modules.js · WIKI 05 · draw_strata',
    portedTo: '/leviathan/chronology',
  },
  {
    id: 'accrete',
    numeral: 'VI',
    title: 'THE ACCRETION',
    kana: '堆積',
    wing: 'WIKI',
    corpus: '147 commits · 36 days',
    blurb: 'The wiki documenting itself: cumulative pages against the log of its own construction.',
    method: 'Pages present at each entry in the build log.',
    status: 'PORTED',
    origin: 'js/wiki-modules.js · WIKI 06 · draw_accrete — rebuilt off git rather than the build log, which is the one change the port made',
    portedTo: '/leviathan/accretion',
  },
  {
    id: 'tagmap',
    numeral: 'VII',
    title: 'THE TAGS',
    kana: '標識',
    wing: 'WIKI',
    corpus: '25 tags · 456 tagged pages',
    blurb: 'Every theme the wiki files under, and what sits beneath it. Hold two and the answer is the pages filed under both.',
    method:
      'Every distinct tag in the corpus, counted, with the pages under it and the domains they fall across. Hold two tags and the pages carrying both are counted. The brackets a YAML array leaves in the raw front-matter are stripped, which is a parse; nothing is dropped for what it says.',
    status: 'LIVE',
    origin:
      'js/wiki-modules.js · WIKI 07 · draw_tagmap — the gravity becomes an intersection, because a count is legible and a physics simulation of a count is a mood',
  },
  {
    id: 'wiki-mass',
    numeral: 'VIII',
    title: 'THE MASS',
    kana: '質量',
    wing: 'WIKI',
    corpus: '486 pages · 630,514 words',
    blurb: 'The corpus by weight as a treemap — every page a rectangle sized by its word count, grouped into its domain.',
    method: 'Word counts per page, squarified by domain. Nothing weighted, nothing excluded.',
    status: 'PORTED',
    origin: 'js/wiki-modules.js · WIKI 08 · draw_mass',
    portedTo: '/leviathan/mass',
  },
  {
    id: 'lattice',
    numeral: 'IX',
    title: 'THE HEALTH',
    kana: '健全',
    wing: 'WIKI',
    corpus: '486 pages · 3,536 links · 10 orphans',
    blurb:
      'Forensics on the graph rather than on what it says: which links go both ways, how the linking is spread, and the ring of pages nothing names.',
    method:
      'Link counts in both directions: how many pages each page names, how many name it, how many links have their reverse in the corpus, and which pages nothing names. An orphan is an inbound count of zero — a count, not a symptom. Nothing here is scored or thresholded.',
    status: 'LIVE',
    origin:
      'js/wiki-modules.js · WIKI 09 · draw_lattice — the name is kept and the diagnosis is not: nothing here knows what a healthy wiki looks like',
  },
  {
    id: 'evidence',
    numeral: 'X',
    title: 'THE EVIDENCE',
    kana: '証拠',
    wing: 'WIKI',
    corpus: '1,170 references · 347 citing pages',
    blurb:
      'What the wiki cites, and where it points. The raw files are not vendored here — the citations are, and counting them is the instrument.',
    method:
      'Every source reference on every page, sorted by the directory its path names and the file type it ends in — both facts about the string, so nothing is classified by guessing what a file contains and nothing lands in an OTHER bucket. A count of citations is not a measure of rigour, and no page is ranked or flagged for having few.',
    status: 'LIVE',
    origin: 'js/wiki-modules.js · WIKI 10 · draw_evidence',
  },
  {
    id: 'chronicle',
    numeral: 'XI',
    title: 'THE CHRONICLE',
    kana: '年代記',
    wing: 'WIKI',
    corpus: 'the wiki’s own build log',
    blurb: 'The wiki building itself as four pens — ingest, connect, write, maintain — against the same axis as THE ACCRETION.',
    method: 'Commits classified into four kinds and counted per day.',
    status: 'SEALED',
    origin: 'js/wiki-modules.js · WIKI 11 · draw_chronicle',
    needs:
      'the build log. And then an argument this building has not had yet: sorting commits into ingest, connect, write and maintain is a classification, and THE RULE would want to know who wrote the rules for it',
  },
  {
    id: 'genesis',
    numeral: 'XII',
    title: 'THE GENESIS',
    kana: '創世',
    wing: 'WIKI',
    corpus: '147 commits · 36 days',
    blurb: 'The knowledge graph forming, in time-lapse — pages per day and edges per day, arriving.',
    method: 'Nodes and edges present at each commit, replayed in order. Nothing smoothed.',
    status: 'UNBUILT',
    origin: 'js/wiki-modules.js · WIKI 12 · draw_genesis',
    needs:
      'nothing from outside — the per-commit counts are already baked into public/leviathan/accretion.json for IV · THE ACCRETION. What is missing is the replay',
  },
  {
    id: 'episteme',
    numeral: 'XIII',
    title: 'THE EPISTEME',
    kana: '認識',
    wing: 'WIKI',
    corpus: '486 pages of prose',
    blurb: 'How sure the record is of itself — where it hedges, where it asserts flatly, where it negates, and where it leaves a question open.',
    method: 'Four rates per page from the prose, grouped by domain, with a volatility figure over them.',
    status: 'BARRED',
    origin: 'js/wiki-analytics.js · WIKI 13 · draw_episteme',
    bars: JUDGEMENT('HEDGING, ASSERTION, NEGATION and OPEN QUESTION are four keyword lists, and calling their mixture “certainty” is the editorial step.'),
  },
  {
    id: 'crucible',
    numeral: 'XIV',
    title: 'THE CRUCIBLE',
    kana: '坩堝',
    wing: 'WIKI',
    corpus: 'every pair of pages that disagree',
    blurb: 'Where the record contradicts itself, sorted by whether the contradiction was ever resolved.',
    method: 'Page pairs scored for tension and contradiction, filtered to the unresolved ones.',
    status: 'BARRED',
    origin: 'js/wiki-analytics.js · WIKI 14 · draw_crucible',
    bars: JUDGEMENT('Deciding that two pages contradict each other, and then that one of them healed it, is a reading of both. The wiki leaves its contradictions in on purpose; scoring them is not the same as keeping them.'),
  },
  {
    id: 'attention',
    numeral: 'XV',
    title: 'THE ATTENTION',
    kana: '注意',
    wing: 'WIKI',
    corpus: '486 pages · every name in them',
    blurb:
      'Documentation debt. Words on a subject’s own page against the number of times other pages name it — the far corner is everything that gets talked about and never written up.',
    method: 'Two counts per subject: words on its page, and mentions of it elsewhere. Both are counts; the diagonal is the only claim.',
    status: 'UNBUILT',
    origin: 'js/wiki-analytics.js · WIKI 15 · draw_attention',
    needs:
      'nothing from outside — both counts come out of the snapshot. What is missing is the instrument, and this is the one worth building first',
  },
  {
    id: 'diction',
    numeral: 'XVI',
    title: 'THE DICTION',
    kana: '語法',
    wing: 'WIKI',
    corpus: '630,514 words across nine domains',
    blurb: 'Each domain’s private vocabulary — the words that are used here and essentially nowhere else in the corpus.',
    method: 'Term frequency per domain against document frequency across all of them.',
    status: 'SEALED',
    origin: 'js/wiki-analytics.js · WIKI 16 · draw_diction',
    needs:
      'nothing from outside — every word ships at /brain. What it needs is a ruling: TF-IDF weights a count by how rare it is, and THE RULE says nothing weighted. Probably defensible, since the weight is computed rather than chosen, but nobody has argued it yet',
  },
  {
    id: 'schema',
    numeral: 'XVII',
    title: 'THE SCHEMA',
    kana: '図式',
    wing: 'WIKI',
    corpus: 'the front-matter of 486 pages',
    blurb: 'The shape of the metadata — which fields are filled in, which are not, and where the record is thin.',
    method: 'Presence and absence of each field, counted. Nothing inferred into an empty one.',
    status: 'UNBUILT',
    origin: 'js/wiki-analytics.js · WIKI 17 · draw_schema',
    needs: 'nothing from outside — the front-matter ships in the snapshot. What is missing is the instrument',
  },
  {
    id: 'echo',
    numeral: 'XVIII',
    title: 'THE ECHO',
    kana: '谺',
    wing: 'WIKI',
    corpus: '486 pages, pairwise',
    blurb: 'Where the wiki repeats itself — the loudest overlaps between two pages, either side readable from the row.',
    method: 'Shared-vocabulary overlap between every pair of pages, ranked.',
    status: 'UNBUILT',
    origin: 'js/wiki-analytics.js · WIKI 18 · draw_echo',
    needs:
      'nothing from outside. Overlap between two texts is a count of what they share, so this one clears THE RULE — it is simply not built',
  },

  // -------------------------------------------------------------------------
  // PROCUREMENT — the unlisted third page, six instruments, all of them scoring.
  //
  // They are listed for completeness and every one of them is BARRED. The page
  // is a hand-assembled pool of quotations sorted into lanes and tiers about a
  // named living person; the sorting is the instrument. Nothing here reproduces
  // its contents, and nothing in THE GALLERY photographs it.

  {
    id: 'proc-agency',
    numeral: 'I',
    title: 'THE AGENCY',
    kana: '主体',
    wing: 'PROCUREMENT',
    corpus: '~55 hand-assembled records',
    blurb: 'The pool played back in order as four pens, each line clicking through to its source row.',
    method: 'Records counted into lanes chosen by hand.',
    status: 'BARRED',
    origin: 'procurement.html · js/procurement.js · I · AGENCY',
    bars: JUDGEMENT('The lanes are a case. Every record was placed in one by a person making an argument about another person.'),
  },
  {
    id: 'proc-ledger',
    numeral: 'II',
    title: 'THE LEDGER',
    kana: '帳簿',
    wing: 'PROCUREMENT',
    corpus: 'the same pool, by day',
    blurb: 'The same records re-sorted day by day and by direction.',
    method: 'Records counted per day per sub-kind.',
    status: 'BARRED',
    origin: 'procurement.html · II · LEDGER — and standalone as ledger.html',
    bars: JUDGEMENT('Re-sorting a hand-assembled case does not make it a count of anything but the case.'),
  },
  {
    id: 'proc-uncond',
    numeral: 'III',
    title: 'THE UNCONDITIONAL',
    kana: '無条件',
    wing: 'PROCUREMENT',
    corpus: 'the same pool',
    blurb: 'Two series set against each other so that the flatness of one is the point.',
    method: 'Two lanes counted over the same ordering.',
    status: 'BARRED',
    origin: 'procurement.html · III · UNCONDITIONAL',
    bars: JUDGEMENT('An instrument built so that an empty lane proves something is an argument with axes.'),
  },
  {
    id: 'proc-clock',
    numeral: 'IV',
    title: 'THE CLOCK',
    kana: '時計',
    wing: 'PROCUREMENT',
    corpus: 'the same pool, monthly',
    blurb: 'The whole span at month resolution, with one window shaded.',
    method: 'Records binned by month; the shaded window is set by hand.',
    status: 'BARRED',
    origin: 'procurement.html · IV · CLOCK',
    bars: JUDGEMENT('The shaded window is the claim, and it was drawn on before the data was.'),
  },
  {
    id: 'proc-prov',
    numeral: 'V',
    title: 'THE PROVENANCE',
    kana: '出所',
    wing: 'PROCUREMENT',
    corpus: 'the same pool, by evidence tier',
    blurb: 'The same records re-sorted by how hard the evidence behind each one is — raw export rows first, one man’s uncorroborated word last.',
    method: 'Records grouped by a hand-assigned provenance tier.',
    status: 'BARRED',
    origin: 'procurement.html · V · PROVENANCE',
    bars: JUDGEMENT('This is the most honest instrument on that page and it is still a hand-assigned ranking of somebody’s own evidence.'),
  },
  {
    id: 'ask',
    numeral: 'VI',
    title: 'THE ASK',
    kana: '請求',
    wing: 'PROCUREMENT',
    corpus: '18,946 messages, recounted from the raw exports',
    blurb: 'Every request, recounted from primary sources, in the order it was made — classified by speech-act frame and then read by hand.',
    method: 'Ledger rows counted from the message export, with per-category precision measured by hand and printed on the instrument.',
    status: 'BARRED',
    origin: 'procurement.html · VI · THE ASK — and standalone as ask.html',
    bars: JUDGEMENT(
      'It is the most carefully built thing in the old repo — deduplicated, timezone-corrected, hand-audited, precision published. And what it publishes is a classification of one person’s requests.',
    ),
    needs: 'the classified ledger itself, which is a hand-audited reading of the record rather than the record, and is not vendored here',
  },
]

/** The wings, in the order the rack draws them. */
export const WINGS: { id: Wing; title: string; kana: string; note: string }[] = [
  {
    id: 'HOUSE',
    title: 'THE HOUSE',
    kana: '自作',
    note: 'Built here. Four instruments, all of them wired to a dataset that ships with this site.',
  },
  {
    id: 'CORPUS',
    title: '◈ CORPUS',
    kana: '記録',
    note: 'Nineteen instruments over the message record. Ten of them make a judgement and do not come across; four need nothing but building.',
  },
  {
    id: 'WIKI',
    title: '◈ WIKI',
    kana: '脳',
    note: 'Eighteen over the second brain. The corpus these read is the snapshot at /brain, which ships — so most of this wing is a to-do list rather than a locked door.',
  },
  {
    id: 'PROCUREMENT',
    title: 'PROCUREMENT',
    kana: '調達',
    note: 'The unlisted third page. Six instruments, every one of them a sorting of hand-assembled quotations about a named living person. All six are barred and none of them is photographed.',
  },
]

export const instrumentsIn = (wing: Wing) => INSTRUMENTS.filter((i) => i.wing === wing)

export const countBy = (status: InstrumentStatus) => INSTRUMENTS.filter((i) => i.status === status).length


export const instrumentById = (id: string) => INSTRUMENTS.find((i) => i.id === id)

// ---------------------------------------------------------------------------
// datasets

const asset = (file: string) => `${import.meta.env.BASE_URL}leviathan/${file}`.replace(/\/{2,}/g, '/')

const cache = new Map<string, Promise<unknown>>()

export function loadSet<T>(file: string): Promise<T> {
  if (!cache.has(file)) {
    cache.set(
      file,
      fetch(asset(file)).then((r) => {
        if (!r.ok) throw new Error(`dataset "${file}" unavailable (${r.status})`)
        return r.json()
      }),
    )
  }
  return cache.get(file) as Promise<T>
}

type Async<T> = { data: T | null; error: string | null; loading: boolean }

export function useSet<T>(file: string): Async<T> {
  const [state, setState] = useState<Async<T>>({ data: null, error: null, loading: true })
  useEffect(() => {
    let live = true
    setState({ data: null, error: null, loading: true })
    loadSet<T>(file)
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((e: Error) => live && setState({ data: null, error: e.message, loading: false }))
    return () => {
      live = false
    }
  }, [file])
  return state
}

// ---------------------------------------------------------------------------
// dataset shapes

export type MassDomain = {
  id: string
  pages: number
  words: number
  links: number
  charts: number
  briefs: number
  longest: { slug: string; title: string; words: number }
}

export type MassSet = {
  domains: MassDomain[]
  pages: { slug: string; title: string; domain: string; words: number }[]
}

export type DateRef = { slug: string; title: string; label: string }

/** A page in a year's panel: its first date there, and how many it named. */
export type YearRef = DateRef & { dates: number }

export type ChronologySet = {
  mentions: number
  months: { bin: string; year: number; month: number; count: number; pages: DateRef[] }[]
  years: { year: number; count: number; pages: number; sample: YearRef[] }[]
}

/**
 * ◈ CORPUS II · THE CLOCK.
 *
 * `marks` is delta-encoded `day * 2880 + minute * 2 + dir` — see the note at
 * the top of scripts/build-clock.mjs. It is a compression of the file, not of
 * the record: all 134,348 messages are in it, one integer each.
 */
export type ClockSet = {
  generatedAt: string
  source: string
  count: number
  sent: number
  received: number
  /** ISO day of the first message — the centre of the spiral. */
  from: string
  /** ISO day of the last — the rim. */
  to: string
  days: number
  hours: { all: number; sent: number; received: number }[]
  years: { year: number; count: number }[]
  /**
   * The runs of months the exports do not cover, in day indices off the same
   * day zero as `marks`. THE PULSE draws them at their real width: a hole in an
   * archive and a quiet month look identical if you only plot what survived.
   */
  gaps: { from: string; to: string; months: number; fromDay: number; toDay: number }[]
  marks: number[]
}

/**
 * ◈ CORPUS V · THE LEXICON.
 *
 * `stoplist` ships with the data on purpose: it is the only filter anywhere in
 * this dataset, and a filter you can read is not the same object as one you
 * cannot. `topAll` is the same table before it is applied.
 */
export type LexiconWord = { word: string; all: number; sent: number; received: number }

export type LexiconSet = {
  generatedAt: string
  source: string
  messages: number
  tokens: number
  distinct: number
  shouts: number
  stoplist: string[]
  top: LexiconWord[]
  topAll: LexiconWord[]
  months: { bin: string; count: number; shouts: number }[]
}

/**
 * The ◈ WIKI wing, all of it, out of one file.
 *
 * Nine instruments read this. One dataset rather than nine because they are all
 * over the same 486 pages, and nine files over one corpus is nine chances for
 * two instruments to disagree about how many pages there are.
 */
export type WikiNode = {
  slug: string
  title: string
  domain: string
  words: number
  out: number
  in: number
  x: number
  y: number
}

export type WikiSet = {
  generatedAt: string
  source: string
  counts: { pages: number; words: number; chartables: number; briefs: number; edges: number }
  domains: { id: string; count: number }[]

  web: { nodes: WikiNode[]; edges: [string, string][] }

  health: {
    pages: number
    edges: number
    reciprocal: number
    orphans: { slug: string; title: string; domain: string; out: number }[]
    outDegrees: { degree: number; count: number }[]
    byDomain: { id: string; pages: number; out: number; in: number; orphans: number }[]
  }

  /** One sentence per link, in the wiki's own words. */
  claims: { from: string; to: string; say: string }[]
  claimsTotal: number

  census: {
    slug: string
    title: string
    from: string | null
    to: string | null
    words: number
    knownFor: string | null
    relationship: string | null
  }[]

  tags: { tag: string; count: number; pages: { slug: string; title: string; domain: string }[] }[]
  tagsTotal: number

  evidence: {
    references: number
    roots: { name: string; count: number }[]
    collections: { name: string; count: number }[]
    extensions: { name: string; count: number }[]
    pages: {
      slug: string
      title: string
      domain: string
      words: number
      sources: number
      roots: { root: string; count: number }[]
    }[]
    uncited: number
  }

  attention: {
    slug: string
    title: string
    domain: string
    words: number
    named: number
    backlinks: number
  }[]

  schema: {
    fields: { field: string; count: number; share: number }[]
    byDomain: { id: string; pages: number; fields: number; per: number }[]
    types: { type: string; count: number }[]
  }

  echo: {
    measured: number
    total: number
    identical: number
    byOverlap: EchoPair[]
    byShared: EchoPair[]
  }
}

export type EchoPair = {
  a: string
  aTitle: string
  b: string
  bTitle: string
  shared: number
  overlap: number
  sameDomain: boolean
}

/** The nine domains, in the house's own shorthand. */
export const DOMAIN_KANA: Record<string, string> = {
  people: '人',
  interests: '趣味',
  mind: '心',
  timeline: '年表',
  self: '自己',
  work: '仕事',
  places: '場所',
  health: '健康',
  legal: '法',
}

