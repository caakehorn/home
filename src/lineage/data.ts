/**
 * The pedigree, transcribed from wiki/self/lineage/family-tree.md (a 515-person,
 * 218-family GEDCOM) and cross-referenced against wiki/self/lineage/23andme-genomics.md.
 *
 * `gen` counts generations back from Dan, who is 0. That matches the source's own
 * numbering in the per-line tables, and it is what every autosomal fraction on this
 * page is computed from — 1/2^gen — rather than transcribed. See NOTE_ON_THE_VOID.
 *
 * Only what the record actually states is here. Where the GEDCOM stops, the tree
 * stops, and the stopping is rendered rather than hidden.
 */

export type LineId = 'frank' | 'gillingham' | 'core' | 'shrum' | 'thomas'

export type Person = {
  id: string
  name: string
  /** Generations back from Dan. 0 = Dan, 1 = parents, 2 = grandparents. */
  gen: number
  line: LineId
  /** Lateral offset inside the lane, so spouse pairs do not stack. */
  slot?: number
  born?: number
  bornLabel?: string
  died?: number
  diedLabel?: string
  birthPlace?: string
  deathPlace?: string
  /** Wiki slug, when the person has a page. */
  wiki?: string
  /** Country of birth, for ancestors born outside the US. */
  crossed?: string
  /** False when the GEDCOM records the person's existence and almost nothing else. */
  documented?: boolean
  /** Collateral kin contribute no autosomal DNA; they are relatives, not ancestors. */
  collateral?: boolean
  role?: string
  note?: string
  /** Display name for the lattice, when first+last would not be recognisable. */
  short?: string
}

export const LINES: { id: LineId; label: string; kana: string; lane: number; blurb: string }[] = [
  { id: 'frank', label: 'FRANK', kana: '父父', lane: -2, blurb: "Father's father's line — Ashkenazi, Russia and Germany into Manhattan, then Fayette County" },
  { id: 'gillingham', label: 'GILLINGHAM', kana: '父母', lane: -1, blurb: "Father's mother's line — Pennsylvania settler stock, Emerick and Wikert behind it" },
  { id: 'core', label: 'DIRECT', kana: '直系', lane: 0, blurb: 'Parents, sibling, self' },
  { id: 'shrum', label: 'SHRUM', kana: '母父', lane: 1, blurb: "Mother's father's line — Westmoreland into Allegheny County" },
  { id: 'thomas', label: 'THOMAS·COLDREN', kana: '母母', lane: 2, blurb: "Mother's mother's line — Monongalia County, WV into Fayette County, PA" },
]

export const PEOPLE: Person[] = [
  // ---- direct -----------------------------------------------------------
  { id: 'dan', slot: 0, name: 'Daniel Gillingham Frank', gen: 0, line: 'core', born: 1988, bornLabel: '1 Nov 1988', birthPlace: 'Uniontown, Fayette, PA', role: 'Self' },
  { id: 'vanessa', slot: 1.0, name: 'Vanessa C. Frank', gen: 0, line: 'core', born: 1994, bornLabel: '16 Jan 1994', birthPlace: 'Greensburg, PA', wiki: 'people/vanessa-frank', collateral: true, role: 'Sister' },
  { id: 'rick', slot: -0.5, name: 'Richard Harrison "Rick" Frank', gen: 1, line: 'core', born: 1959, bornLabel: '22 May 1959', birthPlace: 'Uniontown, PA', wiki: 'people/rick-frank', role: 'Father' },
  { id: 'suzanne', slot: 0.5, name: 'Suzanne Whyel Shrum Frank', gen: 1, line: 'core', born: 1962, bornLabel: '15 Sep 1962', birthPlace: 'Pittsburgh, PA', wiki: 'people/suzanne-frank', role: 'Mother' },

  // ---- Frank patrilineal ------------------------------------------------
  { id: 'morley', slot: -0.35, name: 'Morley Jay Frank', gen: 2, line: 'frank', born: 1927, bornLabel: '20 Aug 1927', died: 1998, diedLabel: '13 Dec 1998', birthPlace: 'Brownsville, PA', deathPlace: 'Hopwood, PA', wiki: 'people/morley-frank', role: 'Paternal grandfather', note: 'The only fully Jewish grandparent, and the source of the Ashkenazi signal in the DNA. Seventeen documented residences — the most mobile of the four.' },
  { id: 'davidj', slot: -0.6, name: 'David J. Frank', gen: 3, line: 'frank', born: 1892, bornLabel: '12 Aug 1892', died: 1960, diedLabel: '6 Apr 1960', birthPlace: 'Russia', deathPlace: 'Brownsville, PA', wiki: 'people/david-j-frank', crossed: 'Russia', role: 'Paternal great-grandfather' },
  { id: 'max', slot: -0.75, name: 'Max Frank', gen: 4, line: 'frank', born: 1860, bornLabel: 'abt 1860', died: 1941, diedLabel: '5 Oct 1941', birthPlace: 'New York', deathPlace: 'New York City' },
  { id: 'henry', slot: -0.9, name: 'Henry Frank', gen: 5, line: 'frank', born: 1815, bornLabel: 'abt 1815', died: 1901, diedLabel: '15 Apr 1901', birthPlace: 'Germany', deathPlace: 'Manhattan', crossed: 'Germany', collateral: true, note: 'In New York City from at least 1843 to his death in 1901 — the pre-Civil War Ashkenazi wave, not the 1880–1920 pogrom-era influx.' },
  { id: 'dorothea', short: 'D. Francken', slot: -1.05, name: 'Dorothea Christiana Charlotta Francken', gen: 6, line: 'frank', born: 1781, bornLabel: '1 Juli 1781', collateral: true },

  // ---- Sadie's branch, and the hole in it -------------------------------
  { id: 'sadie', slot: 0.5, name: 'Sadie Harris', gen: 3, line: 'frank', born: 1900, bornLabel: '14 Dec 1900', died: 1997, diedLabel: '27 Nov 1997', birthPlace: 'Austria', deathPlace: 'Hopwood, PA', wiki: 'people/sadie-harris', crossed: 'Austria', role: 'Paternal great-grandmother' },
  {
    id: 'harris-unknown',
    short: 'HARRIS — ?',
    slot: 0.32,
    name: 'Harris',
    gen: 4,
    line: 'frank',
    birthPlace: 'Czechoslovakia',
    crossed: 'Czechoslovakia',
    documented: false,
    note: "Sadie's father. The GEDCOM has a surname and a country and nothing else — no given name, no birth date, no immigration record, no residence history. He is the largest single hole in the tree.",
  },

  // ---- Gillingham (paternal grandmother's line) -------------------------
  { id: 'gay', slot: 0.1, name: 'Gay Gillingham', gen: 2, line: 'gillingham', born: 1939, bornLabel: '1 Jul 1939', birthPlace: 'PA', role: 'Paternal grandmother' },
  { id: 'francis-g', slot: 0.0, name: 'Francis Gillingham', gen: 3, line: 'gillingham', born: 1903, bornLabel: 'abt 1903', died: 1956, diedLabel: '7 Jan 1956', birthPlace: 'PA' },
  { id: 'lillie', slot: -0.1, name: 'Lillie Diwins', gen: 4, line: 'gillingham', born: 1871, bornLabel: 'abt 1871', birthPlace: 'PA' },
  { id: 'susannah', short: 'S. Emerick', slot: -0.2, name: 'Susannah Elizabeth Emerick', gen: 5, line: 'gillingham', born: 1848, bornLabel: '18 Apr 1848', birthPlace: 'Allegheny Co, PA', note: 'Once mis-flagged as European-born because the birthplace string lacked "USA". The correction is why the European-born count is 14 and not 16.' },
  { id: 'nancy', short: 'Nancy Wikert', slot: -0.3, name: 'Nancy "Annie" Wikert', gen: 6, line: 'gillingham', born: 1828, bornLabel: '18 Dec 1828', birthPlace: 'Lom Kinston Co, PA' },

  // ---- Shrum ------------------------------------------------------------
  { id: 'georgejr', short: 'George Shrum Jr', slot: -0.1, name: 'George Dixon Shrum Jr', gen: 2, line: 'shrum', born: 1937, bornLabel: '14 Jun 1937', birthPlace: 'Pittsburgh, PA', role: 'Maternal grandfather', note: 'Married into the line.' },
  { id: 'gdixon', slot: -0.2, name: 'G. Dixon Shrum', gen: 3, line: 'shrum', born: 1896, bornLabel: 'abt 1896', died: 1960, diedLabel: '1960', birthPlace: 'PA', deathPlace: 'Pittsburgh' },
  { id: 'danielshrum', slot: -0.3, name: 'Daniel E. Shrum Jr', gen: 4, line: 'shrum', born: 1846, bornLabel: 'abt 1846', birthPlace: 'PA' },
  { id: 'reuben', slot: -0.4, name: 'Reuben Shrum', gen: 5, line: 'shrum', born: 1818, bornLabel: '1818', birthPlace: 'PA' },

  // ---- Thomas / Van Voorhis / Coldren -----------------------------------
  { id: 'diane', short: 'Diane Voorhis', slot: -0.15, name: 'Rebecca Diane Van Voorhis', gen: 2, line: 'thomas', born: 1939, bornLabel: '30 Jan 1939', birthPlace: 'West Virginia', wiki: 'people/diane-shrum', role: 'Maternal grandmother' },
  { id: 'emmet', slot: -0.55, name: 'Emmet Graden Van Voorhis', gen: 3, line: 'thomas', born: 1917, bornLabel: '1 Aug 1917', birthPlace: 'Dilliner, PA', role: 'Maternal great-grandfather', note: "Fran's first husband." },
  { id: 'fran', short: 'Fran Coldren', slot: 0.45, name: 'Jesse Frances "Fran" Thomas Whyel Coldren', gen: 3, line: 'thomas', born: 1920, bornLabel: '15 Aug 1920', died: 2018, diedLabel: '4 Apr 2018', birthPlace: 'Fort Martin, WV', deathPlace: 'Uniontown, PA', wiki: 'people/fran-coldren', role: 'Maternal great-grandmother' },
  { id: 'ida', slot: 0.4, name: 'Ida Ellen Conwell', gen: 4, line: 'thomas', born: 1880, bornLabel: '14 Aug 1880', birthPlace: 'WV' },
  { id: 'susan', slot: 0.5, name: 'Susan A. Zearly', gen: 5, line: 'thomas', born: 1845, bornLabel: '1 Feb 1845', birthPlace: 'WV' },
  { id: 'amelia', slot: 0.6, name: 'Amelia', gen: 6, line: 'thomas', born: 1813, bornLabel: 'abt 1813', birthPlace: 'WV', note: 'A given name and a state. The maternal line runs out here.' },
]

/** Who descends from whom, for the descent trace. */
export const DESCENT: Record<string, string> = {
  rick: 'dan',
  suzanne: 'dan',
  vanessa: 'dan',
  morley: 'rick',
  gay: 'rick',
  davidj: 'morley',
  sadie: 'morley',
  max: 'davidj',
  henry: 'max',
  dorothea: 'henry',
  'harris-unknown': 'sadie',
  'francis-g': 'gay',
  lillie: 'francis-g',
  susannah: 'lillie',
  nancy: 'susannah',
  georgejr: 'suzanne',
  diane: 'suzanne',
  gdixon: 'georgejr',
  danielshrum: 'gdixon',
  reuben: 'danielshrum',
  fran: 'diane',
  emmet: 'diane',
  ida: 'fran',
  susan: 'ida',
  amelia: 'susan',
}

/** The chain of ids from a person down to Dan. */
export function descentPath(id: string): string[] {
  const path = [id]
  let cursor = id
  const seen = new Set([id])
  while (DESCENT[cursor] && !seen.has(DESCENT[cursor])) {
    cursor = DESCENT[cursor]
    seen.add(cursor)
    path.push(cursor)
  }
  return path
}

/**
 * Autosomal share, halved every generation. Collateral kin — siblings and
 * spouses of ancestors — sit on the tree but contribute nothing, and a
 * sibling is not an ancestor at all.
 */
export function dnaShare(person: Person): number | null {
  if (person.collateral || person.gen === 0) return null
  return 1 / 2 ** person.gen
}

export const fractionLabel = (share: number) => `1/${Math.round(1 / share)}`

/**
 * Percentages here are powers of one half, so they terminate: 50, 25, 12.5,
 * 6.25, 3.125. Rounding 6.25 to "6.3" would blunt exactly the figure this page
 * exists to correct, so trailing zeros are trimmed instead of digits fixed.
 */
export const shareLabel = (share: number) =>
  `${Number((share * 100).toFixed(2))}%`

/**
 * Where the paper record and the DNA can be checked against each other.
 * Source: wiki/self/lineage/hybrid-analysis.md.
 */
export const CROSSCHECK = [
  { label: 'Ashkenazi Jewish', paper: 25, dna: 21.4, expect: 'One fully Jewish grandparent (Morley)', verdict: 'within recombination variance' },
  { label: 'British & Irish', paper: null, dna: 55.8, expect: 'Gillingham / Lewellen / Shrum lines', verdict: 'higher than expected' },
  { label: 'French & German', paper: null, dna: 22.2, expect: 'Shrum / Van Voorhis / Coldren lines', verdict: 'lower than expected' },
  { label: 'Sub-Saharan African', paper: 0, dna: 0.2, expect: 'none documented', verdict: 'anomalous trace' },
] as const

export const HAPLOGROUPS = [
  { line: 'Maternal (mtDNA)', code: 'R0', note: 'Ancient, ancestor of H and V; uncommon in Northern Europe. Runs Suzanne → Diane → Fran → back.' },
  { line: 'Paternal (Y-DNA)', code: 'R-Z93', note: 'Subclade of R1a, found in some Ashkenazi populations. Runs the Frank patriline.' },
] as const

export const CORRIDORS = [
  { id: 'russia', from: 'Russia', hops: ['Manhattan 1900', 'Bronx 1915', 'Brownsville, PA 1920'], who: 'David J. Frank', line: 'frank' as LineId },
  { id: 'austria', from: 'Austria', hops: ['Brownsville, PA by 1920'], who: 'Sadie Harris', line: 'frank' as LineId },
  { id: 'germany', from: 'Germany', hops: ['Manhattan 1815+', 'died Manhattan 1901'], who: 'Henry Frank', line: 'frank' as LineId },
  { id: 'scotland', from: 'Scotland', hops: ['PA / WV, 1700s–1800s'], who: 'Jenkins, Turley, Hunter', line: 'gillingham' as LineId },
  { id: 'palatinate', from: 'Germany / Palatinate', hops: ['PA, 1700s–1800s'], who: 'Klein, Krehbiel, Emerick', line: 'gillingham' as LineId },
  { id: 'netherlands', from: 'Netherlands', hops: ['Oyster Bay, NY', 'PA, 1600s–1700s'], who: 'Van Voorhis', line: 'thomas' as LineId },
] as const

export const SURNAMES = [
  { name: 'Frank', count: 53 }, { name: 'Coldren', count: 38 }, { name: 'Thomas', count: 35 },
  { name: 'Lincoln', count: 31 }, { name: 'Gillingham', count: 28 }, { name: 'Shrum', count: 25 },
  { name: 'Lewellen', count: 14 }, { name: 'Newcomer', count: 12 }, { name: 'Gapen', count: 12 },
  { name: 'Conwell', count: 10 }, { name: 'Jenkins', count: 8 }, { name: 'Van Voorhis', count: 8 },
] as const

export const SCOPE = {
  individuals: 515,
  families: 218,
  directAncestors: 90,
  europeanBorn: 14,
  generations: 7,
} as const

/**
 * The GEDCOM's own note puts the undocumented Harris at "~12.5% of Dan's DNA".
 * By the halving rule he is Dan's great-great-grandfather — Sadie (12.5%) is
 * the great-grandmother — so his share is 6.25%. Every figure on this page is
 * computed from `gen`, so the page shows 6.25% and says why.
 */
export const NOTE_ON_THE_VOID =
  "wiki/self/lineage/family-tree.md puts this man at ~12.5% of Dan's DNA. Sadie, his daughter, is the great-grandmother at 12.5%; one more generation back halves it. This page computes every share from generation depth, so it reads 6.25%."
