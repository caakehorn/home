/**
 * THE ATLAS — the base map, drawn by hand.
 *
 * ---- what this file is, and what it is not --------------------------------
 *
 * The original instrument said it plainly and this one keeps the wording:
 * **the rivers and the interstates are drawn in by hand.** Nothing here is a
 * shapefile, nothing is fetched from a tile server, and no coordinate in this
 * file was measured. Every road is a polyline somebody typed, at the accuracy
 * a person can type one — good to a block or two in town and to a mile or so
 * out on the turnpike, which is the resolution the instrument reads at.
 *
 * That is a drawing decision, and it is separate from the data. THE RULE is
 * about the counts: nothing on this map is counted, weighted or scored. The
 * map is the paper. What gets drawn on it is the movement, and the movement
 * comes from the corpus.
 *
 * ---- the one exception: the Manhattan grid --------------------------------
 *
 * The Upper East Side is not typed street by street, because it does not have
 * to be: the Commissioners' Plan of 1811 laid it out as a rotated rectangular
 * lattice and it is still one. `ues()` generates it from four numbers — the
 * corner at 5th Avenue and East 57th Street, the 29° rotation of the grid off
 * true north, the 80.5 m spacing between numbered streets, and the measured
 * offsets of the avenues from 5th. Generated that way it lands within about
 * 25 m of the real intersections, which is better than hand-typing forty
 * streets would have got, and it means an address on East 76th Street sits on
 * East 76th Street rather than near it.
 *
 * Coordinates are `[lon, lat]` throughout, because that is the order the
 * instrument projects in.
 */

/* ==========================================================================
   THE MANHATTAN LATTICE
   ========================================================================== */

/** 5th Avenue at East 57th Street — the corner the whole lattice is hung on. */
const UES_ORIGIN = { lon: -73.974, lat: 40.7638 }
/** The grid is rotated 29° east of true north. Everything else follows. */
const TILT = (29 * Math.PI) / 180
const UP = { n: Math.cos(TILT), e: Math.sin(TILT) } // uptown, along an avenue
const EAST = { n: -Math.sin(TILT), e: Math.cos(TILT) } // crosstown, along a street
/** 20 blocks to the mile: 1609.34 / 20. */
const BLOCK = 80.47
/** Metres east of 5th Avenue. Measured off the avenues, not derived. */
const AVENUES = [
  ['Fifth Ave', 0],
  ['Madison Ave', 150],
  ['Park Ave', 300],
  ['Lexington Ave', 440],
  ['Third Ave', 580],
  ['Second Ave', 860],
  ['First Ave', 1140],
  ['York Ave', 1400],
  ['East End Ave', 1560],
]

const M_PER_DEG_LAT = 111320
const M_PER_DEG_LON = 111320 * Math.cos((40.77 * Math.PI) / 180) // 84,330 at this latitude

/**
 * A point on the Upper East Side lattice: which numbered street, and how many
 * metres east of 5th Avenue. Fractional streets are allowed — a door halfway
 * up the block is at 76.4.
 */
export function ues(street, east) {
  const along = (street - 57) * BLOCK
  const n = along * UP.n + east * EAST.n
  const e = along * UP.e + east * EAST.e
  return [
    round(UES_ORIGIN.lon + e / M_PER_DEG_LON),
    round(UES_ORIGIN.lat + n / M_PER_DEG_LAT),
  ]
}

const round = (n) => Math.round(n * 100000) / 100000

/** The lattice as roads: every numbered street, every avenue. */
function manhattanGrid() {
  const roads = []
  const eastEnd = AVENUES[AVENUES.length - 1][1]
  const york = AVENUES[AVENUES.length - 2][1]

  // Crosstown. East End Avenue only exists from 79th to 90th, so the streets
  // outside that stretch stop at York.
  for (let s = 57; s <= 96; s++) {
    const to = s >= 79 && s <= 90 ? eastEnd : york
    roads.push({
      id: `st-${s}`,
      name: `E ${s}${ordinal(s)} St`,
      kind: s === 79 || s === 86 || s === 96 || s === 66 || s === 72 ? 'crosstown' : 'street',
      pts: [
        ues(s, 0), ues(s, 150), ues(s, 300), ues(s, 440), ues(s, 580),
        ues(s, 860), ues(s, 1140), ues(s, 1400),
        ...(to === eastEnd ? [ues(s, eastEnd)] : []),
      ],
    })
  }

  // Uptown–downtown. Fifth Avenue is drawn along the park wall.
  for (const [name, east] of AVENUES) {
    const from = east === eastEnd ? 79 : 57
    const to = east === eastEnd ? 90 : 96
    const pts = []
    for (let s = from; s <= to; s += 1) pts.push(ues(s, east))
    roads.push({ id: `av-${slug(name)}`, name, kind: 'avenue', pts })
  }

  // The two ramps off the island the corridor actually uses.
  roads.push({
    id: 'fdr',
    name: 'FDR Drive',
    kind: 'highway',
    pts: [ues(57, 1720), ues(63, 1700), ues(72, 1690), ues(80, 1700), ues(90, 1720), ues(96, 1740)],
  })
  roads.push({
    id: 'qbb',
    name: 'Queensboro Bridge',
    kind: 'highway',
    pts: [ues(59, 700), ues(59.5, 1140), ues(60, 1700), [-73.9455, 40.7565]],
  })
  return roads
}

const ordinal = (n) => {
  const t = n % 100
  if (t >= 11 && t <= 13) return 'th'
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

/* ==========================================================================
   THE ROADS

   `kind` is what the road is, not how important it is: it decides how thick
   the line is drawn and nothing else. No road is ranked.
   ========================================================================== */

const ROADS = [
  // ---- the corridor -------------------------------------------------------
  {
    id: 'i76',
    name: 'I-76 · Pennsylvania Turnpike',
    kind: 'interstate',
    pts: [
      [-79.61, 40.2223], [-79.38, 40.11], [-79.2, 40.06], [-79.0781, 40.0084],
      [-78.92, 40.0], [-78.79, 40.02], [-78.5039, 40.0187], [-78.35, 40.01],
      [-78.2456, 39.9976], [-77.98, 40.05], [-77.75, 40.12], [-77.53, 40.16],
      [-77.1889, 40.2015], [-76.98, 40.24], [-76.8867, 40.2732],
    ],
  },
  {
    id: 'i70',
    name: 'I-70',
    kind: 'interstate',
    pts: [
      [-80.2462, 40.174], [-80.05, 40.16], [-79.877, 40.127], [-79.8, 40.135],
      [-79.72, 40.16], [-79.61, 40.2223],
    ],
  },
  {
    id: 'i79',
    name: 'I-79',
    kind: 'interstate',
    pts: [
      [-79.9559, 39.6295], [-80.02, 39.72], [-80.1, 39.82], [-80.1839, 39.897],
      [-80.23, 40.02], [-80.2462, 40.174], [-80.18, 40.29], [-80.09, 40.39],
      [-80.02, 40.44], [-79.9959, 40.4406],
    ],
  },
  {
    id: 'i68',
    name: 'I-68 · National Freeway',
    kind: 'interstate',
    pts: [
      [-79.9559, 39.6295], [-79.82, 39.62], [-79.68, 39.63], [-79.55, 39.67],
      [-79.4, 39.68], [-79.24, 39.66], [-79.06, 39.66], [-78.93, 39.64],
      [-78.76, 39.65], [-78.6, 39.65], [-78.4633, 39.6529],
    ],
  },
  {
    id: 'i78',
    name: 'I-78',
    kind: 'interstate',
    pts: [
      [-76.8867, 40.2732], [-76.66, 40.32], [-76.41, 40.4], [-76.16, 40.47],
      [-75.86, 40.53], [-75.6, 40.58], [-75.4902, 40.6084], [-75.2091, 40.6884],
      [-75.02, 40.66], [-74.9107, 40.6376], [-74.7, 40.62], [-74.45, 40.64],
      [-74.28, 40.68], [-74.1724, 40.7357],
    ],
  },
  {
    id: 'njtp',
    name: 'I-95 · New Jersey Turnpike',
    kind: 'interstate',
    pts: [[-74.1724, 40.7357], [-74.11, 40.73], [-74.0431, 40.7178], [-74.02, 40.755], [-73.9955, 40.7589]],
  },
  {
    id: 'lincoln',
    name: 'Lincoln Tunnel',
    kind: 'highway',
    pts: [[-74.0189, 40.7659], [-74.0, 40.762], [-73.9955, 40.7589]],
  },
  {
    id: 'midtown',
    name: 'W 42nd St · Midtown',
    kind: 'crosstown',
    pts: [[-73.9955, 40.7589], [-73.99, 40.7565], [-73.9822, 40.7549], [-73.9772, 40.7527]],
  },
  {
    id: 'park-av-s',
    name: 'Park Ave',
    kind: 'avenue',
    pts: [[-73.9772, 40.7527], [-73.9745, 40.7575], ues(57, 300)],
  },
  {
    id: 'third-av-s',
    name: 'Third Ave',
    kind: 'avenue',
    pts: [[-73.9713, 40.7521], [-73.9694, 40.7561], ues(57, 580)],
  },

  // ---- Fayette County, the state and US routes ----------------------------
  {
    id: 'us40',
    name: 'US-40 · National Pike',
    kind: 'us',
    pts: [
      [-79.8834, 40.0234], [-79.86, 39.995], [-79.83, 39.965], [-79.79, 39.935],
      [-79.7515, 39.912], [-79.7164, 39.9001], [-79.706, 39.888], [-79.7, 39.877],
      [-79.68, 39.862], [-79.652, 39.846], [-79.63, 39.838], [-79.6, 39.822],
      [-79.592, 39.81], [-79.55, 39.795], [-79.49, 39.785], [-79.42, 39.77],
      [-79.332, 39.746], [-79.2, 39.73], [-79.06, 39.7], [-78.93, 39.66],
      [-78.76, 39.652], [-78.4633, 39.6529],
    ],
  },
  {
    id: 'pa51',
    name: 'PA-51',
    kind: 'state',
    pts: [
      [-79.7164, 39.9001], [-79.735, 39.925], [-79.755, 39.96], [-79.77, 40.0],
      [-79.753, 40.087], [-79.83, 40.11], [-79.877, 40.127], [-79.93, 40.2],
      [-79.97, 40.3], [-79.9959, 40.4406],
    ],
  },
  {
    id: 'pa43',
    name: 'PA-43 · Mon–Fayette Expressway',
    kind: 'highway',
    pts: [
      [-79.7164, 39.9001], [-79.76, 39.92], [-79.8, 39.95], [-79.85, 39.99],
      [-79.8834, 40.0234], [-79.89, 40.07], [-79.9, 40.137], [-79.92, 40.2],
      [-79.94, 40.28], [-79.9959, 40.4406],
    ],
  },
  {
    id: 'pa119',
    name: 'US-119',
    kind: 'us',
    pts: [
      [-79.7395, 39.83], [-79.7295, 39.862], [-79.7224, 39.884], [-79.7164, 39.9001],
      [-79.7, 39.935], [-79.66, 39.96], [-79.62, 39.99], [-79.5892, 40.0184],
      [-79.57, 40.06], [-79.539, 40.147], [-79.53, 40.22], [-79.5389, 40.3015],
    ],
  },
  {
    id: 'pa857',
    name: 'PA-857 · Grays Landing Rd',
    kind: 'state',
    pts: [[-79.7164, 39.9001], [-79.76, 39.885], [-79.83, 39.865], [-79.8967, 39.8462]],
  },
  {
    id: 'pa21',
    name: 'PA-21',
    kind: 'state',
    pts: [[-79.7164, 39.9001], [-79.78, 39.9], [-79.84, 39.898], [-79.9, 39.897], [-79.98, 39.9]],
  },
  {
    id: 'pa381',
    name: 'PA-381',
    kind: 'state',
    pts: [[-79.592, 39.81], [-79.55, 39.83], [-79.52, 39.855], [-79.4926, 39.8687], [-79.47, 39.92], [-79.46, 39.97]],
  },
  {
    id: 'pa711',
    name: 'PA-711 · to Seven Springs',
    kind: 'state',
    pts: [[-79.46, 39.97], [-79.42, 40.0], [-79.38, 40.02], [-79.32, 40.03], [-79.299, 40.023]],
  },
  {
    id: 'pa31',
    name: 'PA-31',
    kind: 'state',
    pts: [[-79.299, 40.023], [-79.35, 40.05], [-79.38, 40.11], [-79.45, 40.13], [-79.539, 40.147]],
  },
  {
    id: 'pa166',
    name: 'PA-166 · Smithfield Rd',
    kind: 'state',
    pts: [[-79.7164, 39.9001], [-79.74, 39.87], [-79.77, 39.84], [-79.8114, 39.7987], [-79.85, 39.76], [-79.8992, 39.7392]],
  },
  {
    id: 'wv7',
    name: 'US-119 South · to Morgantown',
    kind: 'us',
    pts: [[-79.8992, 39.7392], [-79.92, 39.71], [-79.94, 39.67], [-79.9559, 39.6295]],
  },

  // ---- Uniontown, block by block -----------------------------------------
  {
    id: 'main-st',
    name: 'E Main St · US-40 Business',
    kind: 'local',
    pts: [[-79.7515, 39.912], [-79.735, 39.906], [-79.7255, 39.9022], [-79.7164, 39.9001], [-79.7075, 39.8985], [-79.698, 39.8968]],
  },
  {
    id: 'morgantown-st',
    name: 'Morgantown St',
    kind: 'local',
    pts: [[-79.7164, 39.9001], [-79.7205, 39.8935], [-79.7224, 39.884], [-79.7248, 39.8765], [-79.7295, 39.862]],
  },
  {
    id: 'pittsburgh-st',
    name: 'Pittsburgh St',
    kind: 'local',
    pts: [[-79.7164, 39.9001], [-79.7215, 39.9055], [-79.7285, 39.9105], [-79.735, 39.9145], [-79.7409, 39.9146]],
  },
  {
    id: 'fayette-st',
    name: 'N Fayette St',
    kind: 'local',
    pts: [[-79.7164, 39.9001], [-79.7148, 39.9042], [-79.7142, 39.9105], [-79.7138, 39.9165]],
  },
  {
    id: 'gallatin-av',
    name: 'Gallatin Ave',
    kind: 'local',
    pts: [[-79.7255, 39.9022], [-79.7262, 39.8965], [-79.7268, 39.891], [-79.7272, 39.8862]],
  },
  {
    id: 'virginia-av',
    name: 'Virginia Ave',
    kind: 'local',
    pts: [[-79.7272, 39.8862], [-79.7261, 39.8905], [-79.7255, 39.895], [-79.7248, 39.8995]],
  },
  {
    id: 'belmont-cir',
    name: 'Belmont Circle',
    kind: 'local',
    pts: [
      [-79.7345, 39.8895], [-79.736, 39.888], [-79.7372, 39.8869], [-79.7362, 39.8858],
      [-79.7342, 39.8855], [-79.7328, 39.8866], [-79.7331, 39.8882], [-79.7345, 39.8895],
    ],
  },
  {
    id: 'derrick-av',
    name: 'Derrick Ave',
    kind: 'local',
    pts: [[-79.7272, 39.8862], [-79.7295, 39.8872], [-79.7318, 39.888], [-79.7345, 39.8895]],
  },
  {
    id: 'saratoga-dr',
    name: 'Saratoga Dr',
    kind: 'local',
    pts: [[-79.7409, 39.9146], [-79.7425, 39.9158], [-79.7442, 39.9162], [-79.7458, 39.9152]],
  },
  {
    id: 'bryer-av',
    name: 'Bryer Ave',
    kind: 'local',
    pts: [[-79.7285, 39.9105], [-79.7305, 39.9088], [-79.7322, 39.907], [-79.7338, 39.9058]],
  },
  {
    id: 'coolspring-st',
    name: 'Coolspring St',
    kind: 'local',
    pts: [[-79.7075, 39.8985], [-79.706, 39.9042], [-79.7048, 39.9098], [-79.704, 39.9155]],
  },
  {
    id: 'matthew-dr',
    name: 'Matthew Dr',
    kind: 'local',
    pts: [[-79.698, 39.8968], [-79.6995, 39.8918], [-79.7005, 39.8872], [-79.6997, 39.8834]],
  },
  {
    id: 'ben-franklin',
    name: 'Ben Franklin Hwy',
    kind: 'local',
    pts: [[-79.7164, 39.9001], [-79.7118, 39.8975], [-79.7062, 39.8952], [-79.7, 39.8935]],
  },
  {
    id: 'country-club-rd',
    name: 'Country Club Rd',
    kind: 'local',
    pts: [[-79.7248, 39.8765], [-79.728, 39.8775], [-79.7305, 39.8772], [-79.733, 39.8758]],
  },
  {
    id: 'walnut-hill',
    name: 'Walnut Hill Rd',
    kind: 'local',
    pts: [[-79.7, 39.877], [-79.706, 39.874], [-79.712, 39.872], [-79.718, 39.8735]],
  },

  // ---- Farmington and Wharton Township ------------------------------------
  {
    id: 'smith-school',
    name: 'Smith School House Rd',
    kind: 'local',
    pts: [[-79.592, 39.81], [-79.598, 39.813], [-79.605, 39.818], [-79.612, 39.8225]],
  },
  {
    id: 'nemacolin-dr',
    name: 'Nemacolin Woodlands entrance',
    kind: 'local',
    pts: [[-79.592, 39.81], [-79.578, 39.807], [-79.566, 39.8036], [-79.562, 39.802]],
  },
  {
    id: 'shepherds-rock',
    name: 'Shepherds Rock',
    kind: 'local',
    pts: [[-79.562, 39.802], [-79.558, 39.799], [-79.554, 39.795], [-79.55, 39.792]],
  },

  // ---- Brooklyn, the 2010–2013 chapter ------------------------------------
  {
    id: 'bedford-av',
    name: 'Bedford Ave',
    kind: 'avenue',
    pts: [[-73.9605, 40.7195], [-73.9615, 40.716], [-73.9628, 40.7125], [-73.9638, 40.709], [-73.9648, 40.705]],
  },
  {
    id: 'berry-st',
    name: 'Berry St',
    kind: 'street',
    pts: [[-73.9635, 40.7192], [-73.9645, 40.7155], [-73.9658, 40.712], [-73.9668, 40.7085]],
  },
  {
    id: 'broadway-bk',
    name: 'Broadway · Williamsburg',
    kind: 'street',
    pts: [[-73.9682, 40.7062], [-73.9638, 40.709], [-73.9608, 40.7108], [-73.9575, 40.7128]],
  },
  {
    id: 'wburg-bridge',
    name: 'Williamsburg Bridge',
    kind: 'highway',
    pts: [[-73.9682, 40.7062], [-73.975, 40.7108], [-73.9805, 40.7148], [-73.9838, 40.7168]],
  },
]

/* ==========================================================================
   THE WATER — the rivers the original drew in by hand, kept.
   ========================================================================== */

const WATERS = [
  {
    id: 'monongahela',
    name: 'Monongahela River',
    pts: [
      [-80.14, 39.48], [-80.05, 39.55], [-79.98, 39.6], [-79.9559, 39.6295],
      [-79.925, 39.68], [-79.9, 39.72], [-79.8992, 39.7392], [-79.89, 39.79],
      [-79.88, 39.85], [-79.885, 39.9], [-79.87, 39.96], [-79.8834, 40.0234],
      [-79.89, 40.07], [-79.9, 40.137], [-79.87, 40.2], [-79.86, 40.28],
      [-79.92, 40.36], [-79.9959, 40.4406],
    ],
  },
  {
    id: 'youghiogheny',
    name: 'Youghiogheny River',
    pts: [
      [-79.4, 39.6], [-79.44, 39.7], [-79.47, 39.78], [-79.4926, 39.8687],
      [-79.53, 39.93], [-79.56, 39.98], [-79.5892, 40.0184], [-79.63, 40.08],
      [-79.7, 40.13], [-79.78, 40.2], [-79.86, 40.28],
    ],
  },
  {
    id: 'allegheny',
    name: 'Allegheny River',
    pts: [[-79.72, 40.72], [-79.8, 40.62], [-79.86, 40.54], [-79.93, 40.48], [-79.9959, 40.4406]],
  },
  {
    id: 'ohio',
    name: 'Ohio River',
    pts: [[-79.9959, 40.4406], [-80.08, 40.5], [-80.18, 40.53], [-80.3, 40.6]],
  },
  {
    id: 'susquehanna',
    name: 'Susquehanna River',
    pts: [[-76.72, 40.62], [-76.79, 40.48], [-76.86, 40.37], [-76.8867, 40.2732], [-76.86, 40.16], [-76.8, 40.05], [-76.72, 39.95]],
  },
  {
    id: 'delaware',
    name: 'Delaware River',
    pts: [[-75.05, 41.0], [-75.13, 40.86], [-75.2091, 40.6884], [-75.06, 40.55], [-74.94, 40.4], [-74.87, 40.28], [-75.14, 39.94]],
  },
  {
    id: 'hudson',
    name: 'Hudson River',
    pts: [[-73.92, 41.05], [-73.95, 40.95], [-73.98, 40.86], [-74.0, 40.79], [-74.017, 40.72], [-74.04, 40.66]],
  },
  {
    id: 'east-river',
    name: 'East River',
    pts: [
      [-73.902, 40.79], [-73.925, 40.775], [-73.9435, 40.762], [-73.9605, 40.747],
      [-73.9725, 40.735], [-73.9755, 40.72], [-73.9862, 40.7], [-74.015, 40.69],
    ],
  },
  {
    id: 'harlem-river',
    name: 'Harlem River',
    pts: [[-73.93, 40.85], [-73.925, 40.82], [-73.918, 40.8], [-73.902, 40.79]],
  },
  {
    id: 'newark-bay',
    name: 'Newark Bay',
    pts: [[-74.13, 40.72], [-74.12, 40.68], [-74.13, 40.64], [-74.16, 40.6]],
  },
]

/* ==========================================================================
   THE CITIES — a name, a place, and how big the label is drawn. `rank` is a
   drawing weight, not a measurement of anything: 0 is a metropolis, 3 is a
   crossroads with a name.
   ========================================================================== */

const CITIES = [
  ['new-york', 'NEW YORK', -73.9857, 40.7484, 0],
  ['brooklyn', 'BROOKLYN', -73.9442, 40.6782, 1],
  ['jersey-city', 'Jersey City', -74.0431, 40.7178, 2],
  ['newark', 'Newark', -74.1724, 40.7357, 1],
  ['easton', 'Easton', -75.2091, 40.6884, 2],
  ['allentown', 'Allentown', -75.4902, 40.6084, 2],
  ['harrisburg', 'HARRISBURG', -76.8867, 40.2732, 1],
  ['carlisle', 'Carlisle', -77.1889, 40.2015, 3],
  ['breezewood', 'Breezewood', -78.2456, 39.9976, 3],
  ['bedford', 'Bedford', -78.5039, 40.0187, 3],
  ['somerset', 'Somerset', -79.0781, 40.0084, 3],
  ['new-stanton', 'New Stanton', -79.61, 40.2223, 3],
  ['greensburg', 'Greensburg', -79.5389, 40.3015, 2],
  ['pittsburgh', 'PITTSBURGH', -79.9959, 40.4406, 0],
  ['washington-pa', 'Washington', -80.2462, 40.174, 2],
  ['waynesburg', 'Waynesburg', -80.1839, 39.897, 3],
  ['charleroi', 'Charleroi', -79.9, 40.137, 3],
  ['belle-vernon', 'Belle Vernon', -79.877, 40.127, 3],
  ['perryopolis', 'Perryopolis', -79.753, 40.087, 3],
  ['mount-pleasant', 'Mount Pleasant', -79.539, 40.147, 3],
  ['connellsville', 'Connellsville', -79.5892, 40.0184, 2],
  ['brownsville', 'Brownsville', -79.8834, 40.0234, 3],
  ['uniontown', 'UNIONTOWN', -79.7164, 39.9001, 1],
  ['hopwood', 'Hopwood', -79.7, 39.877, 3],
  ['masontown', 'Masontown', -79.8967, 39.8462, 3],
  ['smithfield', 'Smithfield', -79.8114, 39.7987, 3],
  ['point-marion', 'Point Marion', -79.8992, 39.7392, 3],
  ['farmington', 'Farmington', -79.592, 39.81, 3],
  ['chalk-hill', 'Chalk Hill', -79.63, 39.838, 3],
  ['ohiopyle', 'Ohiopyle', -79.4926, 39.8687, 3],
  ['champion', 'Champion', -79.299, 40.023, 3],
  ['addison', 'Addison', -79.332, 39.746, 3],
  ['morgantown', 'MORGANTOWN', -79.9559, 39.6295, 1],
  ['cumberland', 'Cumberland', -78.4633, 39.6529, 2],
  ['fort-martin', 'Fort Martin', -79.96, 39.71, 3],
]

/* ==========================================================================
   THE PLACES — the pins.

   Every named pin here is an address the wiki already publishes, on the page
   named in `page`. Nothing is added to the record by putting it on a map: the
   coordinate is a hand-placement of an address that is already in the prose,
   at street accuracy and no better.

   `kind` is what the wiki calls the place, not a category invented here.
   ========================================================================== */

const P = (id, name, lon, lat, kind, page, note) => ({ id, name, lon, lat, kind, page, note })

const PLACES = [
  // ---- Uniontown ----------------------------------------------------------
  P('337-saratoga', '337 Saratoga Drive', -79.7442, 39.9162, 'home', 'places/337-saratoga-drive',
    'family home, built 1996; base 1996–2008, 2013–2016 and again from Feb 2025'),
  P('155-virginia', '155 Virginia Ave', -79.7255, 39.895, 'home', 'places/155-virginia-ave',
    'Uniontown residence through the poverty-floor and deep-cycle years'),
  P('147-virginia', '147 Virginia Ave', -79.7261, 39.8905, 'local', 'places/155-virginia-ave', 'the same block'),
  P('117-belmont', '117 Belmont Circle', -79.7362, 39.8858, 'family', 'places/117-belmont-circle',
    'the Belmont Circle corner — the corpus’s densest local address after home'),
  P('derrick-ave', 'Derrick Avenue', -79.7318, 39.888, 'local', 'places/derrick-avenue',
    'the approach road to the Belmont corner'),
  P('12-bryer', '12 Bryer Ave', -79.7322, 39.907, 'home', 'self/context-core', 'the 1988–1996 address'),
  P('uniontown-cc', 'Uniontown Country Club', -79.7305, 39.8772, 'leisure', 'self/location-history', null),
  P('sheetz-un', 'Sheetz', -79.7118, 39.8975, 'errand', 'self/location-history', null),
  P('mcdonalds-un', 'McDonald’s', -79.7062, 39.8952, 'errand', 'self/location-history', null),
  P('cvs-un', 'CVS', -79.7205, 39.8935, 'errand', 'self/location-history', null),
  P('keybank-un', 'KeyBank', -79.7215, 39.9055, 'errand', 'self/location-history', null),
  P('sunoco-un', 'Sunoco', -79.7148, 39.9042, 'errand', 'self/location-history', null),
  P('walmart-un', 'Walmart', -79.6997, 39.8834, 'errand', 'self/location-history', null),
  P('vapor-hut', 'Vapor Hut', -79.7075, 39.8985, 'errand', 'self/location-history', null),

  // ---- Farmington / Wharton Township --------------------------------------
  P('73-smith-school', '73 Smith School House Rd', -79.605, 39.818, 'family', 'self/location-history',
    'Farmington — recurring, near the family roots'),
  P('nemacolin', 'Lady Luck Casino Nemacolin', -79.566, 39.8036, 'leisure', 'self/location-history',
    'Wharton Twp — also the Nemacolin work chapter'),
  P('shepherds-rock', 'Shepherds Rock #13', -79.554, 39.795, 'leisure', 'self/location-history', null),
  P('seven-springs', 'Seven Springs', -79.2986, 40.0222, 'leisure', 'places/seven-springs',
    'the childhood ski identity; family unit K2'),

  // ---- Manhattan ----------------------------------------------------------
  P('307-e76', '307 E 76th St', ...ues(76, 1000), 'home', 'places/307-e-76th-st',
    'the NYC apartment, Feb 2019 – Feb 2025'),
  P('au-zaatar', 'Au Za’atar · 1063 1st Ave', ...ues(58.6, 1140), 'work', 'work/au-zaatar',
    'the restaurant — a workplace and the most-visited non-residence in the corpus'),
  P('1396-2nd', '1396 2nd Ave', ...ues(72.7, 860), 'local', 'self/location-history', null),
  P('188-e86', '188 E 86th St', ...ues(86, 500), 'local', 'self/location-history', null),
  P('215-e76', '215 E 76th St', ...ues(76, 760), 'local', 'self/location-history', null),
  P('349-e76', '349 E 76th St', ...ues(76, 1080), 'local', 'self/location-history', null),
  P('370-e76', '370 E 76th St', ...ues(76, 1180), 'local', 'self/location-history', null),
  P('pls-check', 'PLS Check Cashing', ...ues(86, 900), 'errand', 'self/location-history', null),
  P('walgreens-ny', 'Walgreens', ...ues(86, 620), 'errand', 'self/location-history', null),
  P('cvs-ny', 'CVS', ...ues(79, 900), 'errand', 'self/location-history', null),
  P('central-park', 'Central Park', ...ues(72, -420), 'leisure', 'self/location-history', null),
  P('grand-central', 'Grand Central', -73.9772, 40.7527, 'transit', 'self/location-history', null),

  // ---- the first New York chapter, before the export starts ---------------
  P('424-bedford', '424 Bedford Ave', -73.9628, 40.7125, 'home', 'places/424-bedford-ave',
    'Brooklyn, Apr 2010 – 2012 — documented, and before the location export begins'),
  P('90th-st', '90th St, Manhattan', ...ues(90, 1000), 'home', 'places/90th-st-manhattan',
    'the third year of the first NYC chapter — documented, before the export begins'),
]

/* ==========================================================================
   THE UNNAMED PINS

   4,306 of the 6,227 visits in the export carry no place name — Google
   redacted or never labelled them. They are not thrown away and they are not
   given invented names: they are drawn as unnamed pins, scattered on the road
   network of whichever region the day is in, and they are labelled UNNAMED on
   the instrument. A blank in the record is drawn as a blank.
   ========================================================================== */

const UNNAMED = { fayette: 26, manhattan: 22, brooklyn: 6 }

/**
 * Where the unnamed pins are allowed to land.
 *
 * Not the whole region: the Fayette County frame runs east to Seven Springs
 * because the roads do, but the record is a life lived between Uniontown,
 * Hopwood and Farmington, and scattering unlabelled visits across the whole
 * frame would draw a commute nobody made. The box is the lived-in core, which
 * is a drawing decision about where blanks are placed, not a claim about any
 * particular one.
 */
const UNNAMED_CORE = {
  fayette: [-79.8, 39.79, -79.54, 39.95],
  manhattan: [-73.99, 40.745, -73.938, 40.79],
  brooklyn: [-73.98, 40.7, -73.95, 40.723],
}

export const GEOGRAPHY = {
  cities: CITIES.map(([id, name, lon, lat, rank]) => ({ id, name, lon, lat, rank })),
  roads: [...ROADS, ...manhattanGrid()],
  waters: WATERS,
  places: PLACES,
  unnamed: UNNAMED,
  unnamedCore: UNNAMED_CORE,
  regions: [
    { id: 'fayette', name: 'FAYETTE COUNTY', bounds: [-79.95, 39.72, -79.25, 40.06] },
    { id: 'manhattan', name: 'UPPER EAST SIDE', bounds: [-73.985, 40.752, -73.925, 40.789] },
    { id: 'brooklyn', name: 'WILLIAMSBURG', bounds: [-73.98, 40.70, -73.95, 40.723] },
    { id: 'corridor', name: 'THE CORRIDOR', bounds: [-80.3, 39.55, -73.85, 40.8] },
  ],
}
