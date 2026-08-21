/**
 * THE GALLERY — the capture rig.
 *
 *   npm i --no-save playwright
 *   node scripts/capture-gallery.mjs ../leviathan
 *   LEVIATHAN=/path/to/leviathan node scripts/capture-gallery.mjs
 *
 * Every other room here is a *rebuild* of the old repo: the datasets get
 * dragged over and re-drawn in this house's own type and colour. THE GALLERY is
 * the opposite and is the only room that is — it photographs the old site
 * running, as it was, in its own slime-green, and hangs the pictures.
 *
 * That is why this script exists rather than a hand-cropped folder of PNGs. A
 * screenshot pasted into a repo is an assertion; a rig that can be re-run
 * against a checkout is a method. Everything below is reproducible from
 * [`caakehorn/leviathan`](https://github.com/caakehorn/leviathan) at any commit.
 *
 * ---- how it works -------------------------------------------------------
 *
 *   1. serve   the leviathan checkout over http://127.0.0.1, because half of
 *              it fetches JSON and file:// has no origin to fetch from.
 *   2. unlock  THE GATE is a *render* gate — it hides <body> until a
 *              passphrase sticks. Both gate modules bail out early if their
 *              global already exists, so defining it before the document runs
 *              is the whole bypass. Nothing is decrypted and nothing needs to
 *              be: every page captured below reads plaintext data that ships
 *              in the open (data/tree.json, data/wiki-data.json, js/*-data.js).
 *              THE CONSOLE ITSELF IS NOT CAPTURABLE and is not attempted —
 *              its 37 instruments read data/leviathan.enc, which needs the real
 *              passphrase. What is here is PHASE 00 and PHASE 01, which do not.
 *   3. vendor  the old pages pull React and Google Fonts off a CDN. Both are
 *              cached into .gallery-vendor/ on the first run and served back
 *              from disk, so a capture is not at the mercy of a CDN and comes
 *              out byte-identical on a second run.
 *   4. shoot   a still is a JPEG; a motion plate is a WebM plus a poster frame
 *              taken from the same session, so the card has something to show
 *              before anyone presses play.
 *
 * Each plate writes a `.json` sidecar beside its media. `npm run gallery` reads
 * those and builds the manifest — see scripts/build-gallery.mjs.
 *
 * ---- what is not photographed -------------------------------------------
 *
 * THE DRUG LEDGER, THE FAMILY LEDGER, PROCUREMENT and THE ASK are all in the
 * rack at /leviathan and none of them are here. They are pages of verbatim
 * quotation and composite scoring about a named living person, and THE RULE
 * this building runs on says an instrument that makes a judgement does not get
 * built here. Photographing one instead would be the same act with a camera in
 * front of it.
 */
import { createServer } from 'node:http'
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { readFile, writeFile, readdir, stat } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join, extname, resolve, dirname } from 'node:path'

const SOURCE = resolve(process.argv.find((a) => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]) ?? process.env.LEVIATHAN ?? '../leviathan')
const OUT = 'public/gallery/media'
const VENDOR = '.gallery-vendor'
const PORT = Number(process.env.GALLERY_PORT ?? 8791)
const ORIGIN = `http://127.0.0.1:${PORT}`
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice('--only='.length)
const SKIP_MOTION = process.argv.includes('--no-motion')

/** Playwright ships its own ffmpeg for video recording; motion plates are trimmed with it when it is there. */
const FFMPEG = process.env.PW_FFMPEG ?? '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux'

const REACT_URL = 'https://unpkg.com/react@18.3.1/umd/react.production.min.js'
const REACT_DOM_URL = 'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js'
const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=IBM+Plex+Mono:wght@400;600;700&display=swap'
const UA_DESKTOP =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

// ---------------------------------------------------------------------------
// the plates
//
// `source` is the file in the old repo the picture is of, and it is not
// decoration: a photograph of a visualiser with no path back to the thing that
// drew it is a mood board. `shot` says what the camera was told to do, for the
// same reason every instrument in the rack owes a method line.

/** @type {Array<Record<string, any>>} */
const PLATES = [
  {
    id: 'the-threshold',
    title: 'THE THRESHOLD',
    kana: '境',
    page: 'index.html',
    source: 'index.html',
    settle: 4000,
    caption:
      'The one public page of the old site: a starfield being drawn very slowly toward the centre, and two unmarked doors. Nothing behind either is named. The left one is sealed and the right one records you on the way in.',
    shot: '1600×1000, four seconds after load, no interaction.',
    motion: { seconds: 8, caption: 'The pull. 260 stars falling inward at 0.55% of the frame per tick, which is the whole animation.' },
  },
  {
    id: 'the-gravity-well',
    title: 'THE GRAVITY WELL',
    kana: '重力',
    page: 'void.html',
    source: 'void.html · PHASE 00 · js/galaxy-cluster.js',
    settle: 6000,
    caption:
      'PHASE 00. The wordmark is not type — it is a particle cluster holding the shape of one, and it comes apart if you grab it. Click is a shockwave, hold is a vortex. The four colour families are the whole SLIME palette: slime, mint, purple, hot pink.',
    shot: '1600×1000, six seconds after load, cluster left alone.',
    motion: { seconds: 8, caption: 'The cluster running untouched. Nothing here is a video loop or a shader — it is a CPU particle simulation being asked to hold a word.' },
  },
  {
    id: 'the-void-console',
    title: 'THE VOID CONSOLE',
    kana: '虚',
    page: 'void.html',
    source: 'void.html · PHASE 01',
    settle: 5000,
    prep: async (page) => {
      await page.getByText('ENTER THE VOID', { exact: false }).first().click({ timeout: 15000 })
      await page.waitForTimeout(4500)
    },
    caption:
      'PHASE 01, the index of the whole old site in five numbered sections. This is the page that says 37 INSTRUMENTS · 3 CHAPELS out loud, and it is the manifest the rack at /leviathan was rebuilt from.',
    shot: '1600×1000, after ENTER THE VOID, four and a half seconds to settle.',
    motion: {
      seconds: 10,
      caption: 'The descent through all five sections — 01 THE CORPUS, 02 THE WIKI, 03 ANNIE, 04 THE TEMPLE, 05 OPEN A CHANNEL.',
      prep: async (page) => {
        await page.getByText('ENTER THE VOID', { exact: false }).first().click({ timeout: 15000 })
        await page.waitForTimeout(3000)
      },
      during: async (page) => {
        for (let i = 0; i < 26; i++) {
          await page.mouse.wheel(0, 260)
          await page.waitForTimeout(220)
        }
      },
      trim: { start: 4.5 },
    },
  },
  {
    id: 'the-singularity',
    title: 'THE SINGULARITY',
    kana: '特異点',
    page: 'singularity.html',
    source: 'singularity.html · js/singate.js',
    settle: 4500,
    caption:
      'The second wing’s door. Three checks stand behind it and the first two log who you are before the third tells you whether you are getting in — an ordering the page states plainly rather than hides.',
    shot: '1600×1000, four and a half seconds after load.',
  },
  {
    id: 'the-temple',
    title: 'THE TEMPLE',
    kana: '神殿',
    page: 'temple.html',
    source: 'temple.html · js/temple.js',
    settle: 4500,
    caption: 'The section index for the chapels — the three standalone instruments that sit outside the console.',
    shot: '1600×1000, four and a half seconds after load.',
  },
  {
    id: 'chapel-iii-the-clock',
    title: 'CHAPEL III · THE CLOCK',
    kana: '時計',
    page: 'clock.html',
    source: 'clock.html · js/annie.js',
    viewport: { width: 1600, height: 1400 },
    settle: 9000,
    caption:
      'Eleven years of one person’s messages as a single spiral. Angle is the hour of the day, radius is the date — first message at the centre, last at the rim. Nothing is excluded, weighted or smoothed. The dark wedge is sleep.',
    shot: '1600×1400, nine seconds after load — the spiral draws itself in and this is where it stops.',
    motion: { seconds: 11, caption: 'The spiral drawing itself, 68,998 points, from the first message outward.', trim: { start: 1.5 } },
  },
  {
    id: 'chapel-ii-the-voice',
    title: 'CHAPEL II · THE VOICE',
    kana: '声',
    page: 'voice.html',
    source: 'voice.html · js/annie.js',
    settle: 5000,
    caption:
      'A trigram chain over one half of the corpus. It is not her, not a quote and not a prediction — it is the shape of 434,795 words with the meaning taken out, which is a thing worth being able to look at once.',
    shot: '1600×1000, five seconds after load.',
  },
  {
    id: 'chapel-i-the-oracle',
    title: 'CHAPEL I · THE ORACLE',
    kana: '神託',
    page: 'oracle.html',
    source: 'oracle.html · js/temple.js',
    settle: 5000,
    caption: 'The seeded oracle. A field, a deterministic random number generator and a sigil — the same question returns the same answer forever, which is the joke and also the method.',
    shot: '1600×1000, five seconds after load.',
  },
  {
    id: 'the-line',
    title: 'THE LINE',
    kana: '血統',
    page: 'tree.html',
    source: 'tree.html · js/tree.js · data/tree.json',
    settle: 7000,
    caption:
      'The family tree as an hourglass around one focus person: ancestors climbing away above, descendants spreading below, spouses beside. 515 people, 218 families, 15 generations, 1575→2002, and it says out loud that 71% of it is sourced.',
    shot: '1600×1000, seven seconds after load, at the default focus.',
    motion: {
      seconds: 10,
      caption: 'Re-centring. Click anyone and the whole hourglass re-lays itself around them — this is four generations being walked in one take.',
      during: async (page) => {
        for (const label of ['Richard Harrison Frank', 'Morley Jay Frank', 'David J Frank']) {
          await page.getByText(label, { exact: false }).first().click({ timeout: 6000 }).catch(() => {})
          await page.waitForTimeout(2200)
        }
      },
      trim: { start: 6 },
    },
  },
  {
    id: 'the-line-index',
    title: 'THE LINE · THE INDEX',
    kana: '索引',
    page: 'tree.html',
    source: 'tree.html · js/tree.js',
    settle: 6000,
    prep: async (page) => {
      await page.getByText('INDEX', { exact: true }).first().click({ timeout: 10000 })
      await page.waitForTimeout(2500)
    },
    caption: 'The same dataset with the drawing taken away: every person in the tree as a row, sourced or not.',
    shot: '1600×1000, after switching to INDEX.',
  },
  {
    id: 'the-wiki-reader',
    title: 'THE WIKI',
    kana: '脳',
    page: 'wiki.html',
    source: 'wiki.html · js/wiki-reader.js · data/wiki-data.json',
    settle: 7000,
    caption:
      'The prose reader — 486 pages, nine domains, the whole second brain with the instruments deliberately left off it. The room at /brain is this rebuilt; this is what it looked like first.',
    shot: '1600×1000, seven seconds after load, at the index.',
  },
  {
    id: 'the-transcript',
    title: 'THE TRANSCRIPT',
    kana: '記録',
    page: 'transcript.html',
    source: 'transcript.html · data/transcript.json',
    settle: 9000,
    caption:
      'The old reader for the message record — the same 134,348 messages now at /transcript, back when getting to the first line meant downloading all 9.4 MB of them.',
    shot: '1600×1000, nine seconds after load — most of which is the envelope arriving.',
  },
  {
    id: 'the-hub',
    title: 'THE HUB',
    kana: '携帯',
    page: 'mobile.html',
    source: 'mobile.html · js/mobile.js',
    viewport: { width: 430, height: 932 },
    settle: 5000,
    caption: 'The whole site folded down to a phone. The console does not fit on one and never pretended to, so the small screen got its own front door instead.',
    shot: '430×932 — iPhone-sized — five seconds after load.',
  },
]

// ---------------------------------------------------------------------------
// vendoring
//
// The old pages load React and Google Fonts from a CDN. Rather than let a
// capture depend on the internet twice, both are pulled once into
// .gallery-vendor/ and served back. The font CSS is filtered to the faces that
// carry basic latin: the full reply is ~500 @font-face blocks, almost all of
// them Japanese subsets these pages never reach for.

async function vendor() {
  mkdirSync(join(VENDOR, 'fonts'), { recursive: true })

  const grab = async (url, path, headers = {}) => {
    if (existsSync(path)) return readFile(path)
    const res = await fetch(url, { headers: { 'user-agent': UA_DESKTOP, ...headers } })
    if (!res.ok) throw new Error(`vendor fetch ${res.status}: ${url}`)
    const buf = Buffer.from(await res.arrayBuffer())
    mkdirSync(dirname(path), { recursive: true })
    await writeFile(path, buf)
    return buf
  }

  const react = await grab(REACT_URL, join(VENDOR, 'react.js'))
  const reactDom = await grab(REACT_DOM_URL, join(VENDOR, 'react-dom.js'))

  const cssPath = join(VENDOR, 'fonts.css')
  let css
  if (existsSync(cssPath)) {
    css = await readFile(cssPath, 'utf8')
  } else {
    const raw = (await grab(FONTS_URL, join(VENDOR, 'fonts.raw.css'))).toString('utf8')
    // Keep only the faces whose unicode-range covers ASCII.
    const blocks = raw.split(/(?=@font-face)/).filter((b) => !b.includes('@font-face') || /U\+0000-00FF/.test(b))
    css = blocks.join('')
    let i = 0
    for (const url of [...new Set([...css.matchAll(/https:\/\/fonts\.gstatic\.com\/[^)]+/g)].map((m) => m[0]))]) {
      const name = `f${i++}.woff2`
      await grab(url, join(VENDOR, 'fonts', name))
      css = css.split(url).join(`${ORIGIN}/__vendor/fonts/${name}`)
    }
    await writeFile(cssPath, css)
  }

  return { react, reactDom, css }
}

// ---------------------------------------------------------------------------
// the server

function serve(root) {
  const TYPES = {
    '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
    '.enc': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png',
    '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain',
  }
  const server = createServer(async (req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0])
    let path = url.startsWith('/__vendor/')
      ? join(VENDOR, url.slice('/__vendor/'.length))
      : join(root, url === '/' ? '/index.html' : url)
    try {
      if ((await stat(path)).isDirectory()) path = join(path, 'index.html')
      const body = await readFile(path)
      res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream', 'access-control-allow-origin': '*' })
      res.end(body)
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end('404')
    }
  })
  return new Promise((ok) => server.listen(PORT, '127.0.0.1', () => ok(server)))
}

// THE GATE bails out early when its global is already defined. That is the bypass.
const UNLOCK = () => {
  window.LVGate = { locked: () => false, passphrase: () => null, punish: async () => {}, greeting: '' }
  window.LVSinGate = { locked: () => false }
}

const strip = (page) =>
  page.evaluate(() => document.documentElement.classList.remove('lv-locked', 'lv-sealed'))

// ---------------------------------------------------------------------------

async function main() {
  if (!existsSync(join(SOURCE, 'void.html'))) {
    console.error(`Not a leviathan checkout: ${SOURCE}`)
    console.error('Pass one: node scripts/capture-gallery.mjs ../leviathan')
    process.exit(1)
  }

  let chromium
  try {
    ;({ chromium } = await import('playwright'))
  } catch {
    console.error('playwright is not installed. It is a capture-time tool, not a dependency of the site:')
    console.error('  npm i --no-save playwright')
    process.exit(1)
  }

  const { react, reactDom, css } = await vendor()
  const server = await serve(SOURCE)
  const plates = PLATES.filter((p) => !ONLY || ONLY.split(',').includes(p.id))
  const executablePath = process.env.PW_CHROMIUM ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
  const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] })

  const context = async (extra = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, userAgent: UA_DESKTOP, ...extra })
    await ctx.addInitScript(UNLOCK)
    await ctx.route('**://unpkg.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/javascript',
        headers: { 'access-control-allow-origin': '*' },
        body: route.request().url().includes('react-dom') ? reactDom : react,
      }))
    await ctx.route('**://fonts.googleapis.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/css', headers: { 'access-control-allow-origin': '*' }, body: css }))
    // GoatCounter is loaded by the gate on every page. A capture is not a visit.
    await ctx.route('**://*.goatcounter.com/**', (route) => route.abort())
    await ctx.route('**://api.ipify.org/**', (route) => route.abort())
    return ctx
  }

  mkdirSync(OUT, { recursive: true })

  for (const plate of plates) {
    // Position in PLATES, not in the filtered run: `--only` must not renumber
    // the gallery, or a re-shoot of one plate reorders the whole wall.
    const order = PLATES.indexOf(plate)
    const dir = join(OUT, 'leviathan')
    mkdirSync(dir, { recursive: true })
    const viewport = plate.viewport ?? { width: 1600, height: 1000 }

    // ---- the still -------------------------------------------------------
    {
      const ctx = await context({ viewport })
      const page = await ctx.newPage()
      await page.goto(`${ORIGIN}/${plate.page}`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
      await page.waitForTimeout(plate.settle ?? 5000)
      await strip(page)
      if (plate.prep) await plate.prep(page)
      await strip(page)
      await page.screenshot({ path: join(dir, `${plate.id}.jpg`), type: 'jpeg', quality: 86 })
      await writeFile(
        join(dir, `${plate.id}.json`),
        JSON.stringify(
          { title: plate.title, kana: plate.kana, caption: plate.caption, source: plate.source, shot: plate.shot, order: order * 2, w: viewport.width, h: viewport.height },
          null, 2,
        ) + '\n',
      )
      await ctx.close()
      console.log(`still  ${plate.id}`)
    }

    // ---- the motion plate ------------------------------------------------
    if (plate.motion && !SKIP_MOTION) {
      const m = plate.motion
      const size = { width: 1280, height: Math.round((viewport.height / viewport.width) * 1280) }
      const vdir = join(OUT, '.video-tmp')
      rmSync(vdir, { recursive: true, force: true })
      const ctx = await context({ viewport, recordVideo: { dir: vdir, size } })
      const page = await ctx.newPage()
      await page.goto(`${ORIGIN}/${plate.page}`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
      await page.waitForTimeout(plate.settle ?? 5000)
      await strip(page)
      if (m.prep) await m.prep(page)
      await strip(page)
      await page.screenshot({ path: join(dir, `${plate.id}-motion.poster.jpg`), type: 'jpeg', quality: 86 })
      if (m.during) await m.during(page)
      else await page.waitForTimeout(m.seconds * 1000)
      await ctx.close()

      const [file] = (await readdir(vdir)).filter((f) => f.endsWith('.webm'))
      const raw = join(vdir, file)
      const dest = join(dir, `${plate.id}-motion.webm`)
      // Recording starts when the context does, so every clip has a lead-in of
      // page load in front of it, and the raw encode is whatever the recorder
      // felt like. One pass through ffmpeg fixes both: seek past the lead-in,
      // hold the stated number of seconds, and land on a bitrate a repository
      // can carry. Without ffmpeg the raw file ships as-is rather than nothing.
      if (existsSync(FFMPEG)) {
        execFileSync(FFMPEG, ['-y', '-ss', String(m.trim?.start ?? 0), '-i', raw, '-t', String(m.seconds),
          '-c:v', 'libvpx', '-b:v', '800k', '-cpu-used', '4', '-an', dest], { stdio: 'ignore' })
      } else {
        renameSync(raw, dest)
      }
      rmSync(vdir, { recursive: true, force: true })
      await writeFile(
        join(dir, `${plate.id}-motion.webm.json`),
        JSON.stringify(
          { title: plate.title, kana: plate.kana, caption: m.caption ?? plate.caption, source: plate.source, shot: plate.shot, order: order * 2 + 1, w: size.width, h: size.height },
          null, 2,
        ) + '\n',
      )
      console.log(`motion ${plate.id}`)
    }
  }

  await browser.close()
  server.close()
  console.log(`\n${plates.length} plates → ${OUT}/leviathan`)
  console.log('Now run: npm run gallery')
}

await main()
