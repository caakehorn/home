/**
 * The gate on THE TOOL.
 *
 *   npm run tool:check
 *   npm run tool:check -- --bless    # rewrite the golden files, deliberately
 *
 * ---- what a tool asserts, and why it is not a typecheck ---------------------
 *
 * Every tool in this room emits a command somebody runs against their own
 * machine. `tsc` proves the code that assembles it compiles. It proves nothing
 * about whether the SQL references a column that exists, whether a contact
 * called `Robert'); DROP` survives quoting, or whether the same answers produce
 * the same command twice. Those are the three ways this room fails, so those
 * are the three things checked here — plus the golden files, which turn any
 * other drift into a visible diff instead of a silent one.
 *
 * 1. DETERMINISM. Every fixture is composed twice and the two are compared
 *    byte for byte. A `Date.now()` or an unseeded iteration order that crept
 *    into a `compose` fails here rather than the first time somebody wonders
 *    why the command changed between two page loads.
 *
 * 2. GOLDEN FILES. `scripts/fixtures/tool/*.sh` is the command as it stands.
 *    A change to it is a reviewable diff. Regenerating is `--bless`, which is
 *    deliberate and leaves a diff of its own.
 *
 * 3. INJECTION. An adversarial answer set — quotes, backticks, `$(…)`,
 *    semicolons, newlines, `--`, a heredoc delimiter — is composed, and the
 *    result is checked to confirm every dangerous byte is inside a quoted run
 *    rather than loose in the script.
 *
 * 4. THE SQL ACTUALLY RUNS. sqlite3 is not installed in the container this is
 *    built in, but python3 is and ships the sqlite3 module. A synthetic chat.db
 *    is built from the real schema — see `scripts/tool-chatdb.py` for what is
 *    in it and why — and every generated query is executed against it, with the
 *    row count asserted exactly.
 *
 * Failures print what happened and what to do about it, then exit 1. Nothing
 * throws: a stack trace is not a message to a person.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { bundle } from './build-tool-entry.mjs'

const ROOT = process.cwd()
const GOLDEN = join(ROOT, 'scripts', 'fixtures', 'tool')
const BLESS = process.argv.includes('--bless')

/* ==========================================================================
   THE FIXTURES

   `expect` is worked out by hand from the fixture database in
   scripts/tool-chatdb.py, not read back out of the query. A number the query
   produced cannot check the query.

   A tool adds its own entries here. That is the whole of its obligation to
   this file.
   ========================================================================== */

const FIXTURES = [
  {
    name: 'imessage-conversation-all',
    tool: 'imessage',
    why: 'The default path: one person, whole conversation, everything.',
    answers: {
      home: '$HOME',
      target: 'number',
      handle: '+1 555 010 4477',
      scope: 'conversation',
      window: 'all',
      format: 'csv',
    },
    // chat 1 holds messages 1,2,3,7,8,9,10 and chat 2 holds 4,5,10.
    // Message 10 is in both and must come back ONCE: 7 + 3 - 1 = 9.
    expect: { rows: 9 },
  },
  {
    name: 'imessage-handle-only',
    tool: 'imessage',
    why: 'Handle scope must drop the group traffic the conversation scope keeps.',
    answers: {
      home: 'dan',
      target: 'number',
      handle: '5550104477',
      scope: 'handle',
      window: 'all',
      format: 'csv',
    },
    // handle_id 1 -> messages 1,2,3,5,8,9,10; handle_id 2 -> message 7.
    // The same person under two formats, which is the point of the tail match.
    expect: { rows: 8 },
  },
  {
    name: 'imessage-appleid-window',
    tool: 'imessage',
    why: 'An Apple ID target, and an absolute window in the reader’s own dates.',
    answers: {
      home: '$HOME',
      target: 'appleid',
      handle: 'SomeOne@iCloud.com',
      scope: 'conversation',
      window: 'abs:2020-01-01:2020-12-31',
      format: 'txt',
    },
    // Chat 2 is the only one with that handle: messages 4, 5 and 10 — of which
    // 4 and 5 fall inside 2020. Case-insensitively matched.
    expect: { rows: 2 },
  },
  {
    name: 'imessage-everyone-relative',
    tool: 'imessage',
    why: 'No target at all, and a relative window that must stay relative.',
    answers: {
      home: '$HOME',
      target: 'everyone',
      window: 'rel:30:days',
      format: 'csv',
    },
    // The fixture messages are all years old, so a 30-day window ending
    // whenever this runs must return none of them — which is also what proves
    // the window is resolved at run time rather than baked in.
    expect: { rows: 0 },
  },
  {
    name: 'imessage-named-target',
    tool: 'imessage',
    why: 'A contact picked from the address book: the name has to reach the rows.',
    answers: {
      home: '$HOME',
      target: 'number',
      handle: 'Annie Example <+1 555 010 4477>',
      scope: 'handle',
      window: 'all',
      format: 'csv',
    },
    // The same eight rows as the handle-scope fixture; what is checked here is
    // that the emitted CASE compiles and stamps the name onto every one of them.
    expect: { rows: 8, named: 'Annie Example' },
  },
  {
    name: 'imessage-everyone-all-txt',
    tool: 'imessage',
    why: 'Every message, as a transcript. The widest query the tool can emit.',
    answers: { home: '$HOME', target: 'everyone', window: 'all', format: 'txt' },
    expect: { rows: 10 },
  },
]

/**
 * Answers built to break out of the script.
 *
 * These are not realistic and are not supposed to be. Every one of them is a
 * thing that would land in a shell or in a SQL string if the quoting were done
 * by concatenation, and a contact book is a file somebody else wrote.
 */
const NASTY = [
  `'; rm -rf ~; echo '`,
  '$(whoami)',
  '`id`',
  'a"b\'c',
  "Robert'); DROP TABLE message; --",
  'IMSGX',
  'line-one\nline-two',
  '../../etc/passwd',
  '--flag',
  '%s%s%n',
]

/* ==========================================================================
   THE CHECKS
   ========================================================================== */

const fail = []
const note = (...lines) => fail.push(lines)

function composeTwice(mod, answers) {
  const a = mod.compose({ ...answers })
  const b = mod.compose({ ...answers })
  return [a, b]
}

/** Every SQL block inside a generated script, in order. */
function sqlBlocks(script) {
  const out = []
  const re = /<<'(SQL_[A-Z_]+)'[^\n]*\n([\s\S]*?)\n\1$/gm
  let m
  while ((m = re.exec(script))) out.push({ marker: m[1], sql: m[2] })
  return out
}

async function main() {
  const entryPath = await bundle()
  const {
    MODULES, sh, sq, slug, heredoc,
    parseRange, encodeRange, parseDay,
    fromGoogleCsv, fromVcard, parseContacts, findContacts,
  } = await import(`file://${entryPath}`)

  mkdirSync(GOLDEN, { recursive: true })

  /* ---- 0. the quoting helpers, on their own ----------------------------- */
  for (const nasty of NASTY) {
    const quoted = sh(nasty)
    // A correctly single-quoted shell word contains no unescaped quote: split
    // on the escape sequence and nothing that is left may hold one.
    if (quoted.split(`'\\''`).join('').slice(1, -1).includes("'")) {
      note(`sh() left a loose quote in: ${JSON.stringify(nasty)}`, `  produced: ${quoted}`)
    }
    const sqled = sq(nasty)
    if (sqled.slice(1, -1).replace(/''/g, '').includes("'")) {
      note(`sq() left a loose quote in: ${JSON.stringify(nasty)}`, `  produced: ${sqled}`)
    }
    if (/[/.]/.test(slug(nasty)) || slug(nasty).startsWith('-')) {
      note(`slug() produced something path-unsafe from ${JSON.stringify(nasty)}: ${slug(nasty)}`)
    }
  }
  // The one way a quoted heredoc fails is a body containing its own delimiter.
  let refused = false
  try {
    heredoc('MARK', 'a\nMARK\nb')
  } catch {
    refused = true
  }
  if (!refused) note('heredoc() accepted a body containing its own delimiter line.')

  /* ---- 0b. the date reader ---------------------------------------------- */
  const DATES = [
    ['all', 'all'],
    ['90 days', 'rel:90:days'],
    ['2 weeks', 'rel:14:days'],
    ['6 months', 'rel:6:months'],
    ['1 nov 2018 - 1 dec 2022', 'abs:2018-11-01:2022-12-01'],
    ['2018-11-01 to 2022-12-01', 'abs:2018-11-01:2022-12-01'],
    ['nov 1 2018 — 1 december 2022', 'abs:2018-11-01:2022-12-01'],
  ]
  for (const [input, want] of DATES) {
    const read = parseRange(input)
    if (read.error) note(`parseRange(${JSON.stringify(input)}) refused: ${read.error}`)
    else if (encodeRange(read.range) !== want) {
      note(`parseRange(${JSON.stringify(input)}) gave ${encodeRange(read.range)}, wanted ${want}`)
    }
  }
  // 31 February is not a date, and rolling it into 3 March silently moves a
  // window the reader chose.
  for (const bad of ['31 feb 2019', '2019-13-01', '1 nov 2018', 'soon', '2022-12-01 - 2018-11-01']) {
    if (!parseRange(bad).error) note(`parseRange accepted ${JSON.stringify(bad)}, which is not a window`)
  }
  if (parseDay('31 feb 2019') !== null) note('parseDay rolled 31 February into a real date')

  /* ---- 0c. the contacts parsers ----------------------------------------- */
  // The CSV cases are the ones that matter. A field may hold a comma, a
  // newline and a doubled quote, and a parser that splits on commas shifts
  // every column after the offending row — which puts phone numbers in the
  // name column and is noticed only when an export comes back empty.
  const CSV_TRICKY = [
    'Name,Phone 1 - Value,E-mail 1 - Value',
    '"Example, Annie",+1 555 010 4477,annie@example.com',
    '"He said ""hello""",5550104477,',
    '"Two',
    'lines",+447700900123,uk@example.com',
    'No Number,,',
  ].join('\n')

  const csv = fromGoogleCsv(CSV_TRICKY)
  const csvWant = [
    ['Example, Annie', '+1 555 010 4477'],
    ['He said "hello"', '5550104477'],
    ['Two\nlines', '+447700900123'],
  ]
  if (csv.contacts.length !== 3) {
    note(
      `Google CSV: parsed ${csv.contacts.length} contacts, expected 3.`,
      `  got: ${JSON.stringify(csv.contacts.map((c) => c.name))}`,
    )
  } else {
    csvWant.forEach(([name, first], i) => {
      if (csv.contacts[i].name !== name) {
        note(
          `Google CSV row ${i}: name is ${JSON.stringify(csv.contacts[i].name)}, wanted ${JSON.stringify(name)}.`,
          '  A quoted field holding a comma, a doubled quote or a newline was mis-split.',
        )
      }
      if (csv.contacts[i].handles[0] !== first) {
        note(
          `Google CSV row ${i}: first handle is ${JSON.stringify(csv.contacts[i].handles[0])}, wanted ${JSON.stringify(first)}.`,
          '  Columns shifted — the usual sign of a naive comma split.',
        )
      }
    })
  }
  if (csv.skipped !== 1) {
    note(`Google CSV: reported ${csv.skipped} skipped, expected 1 (the contact with no number).`)
  }

  // Folded lines, an item-prefixed property, and two handles on one card.
  //
  // The fold is subtle and this fixture is written to the spec rather than to
  // intuition: unfolding removes the line break AND the single whitespace that
  // follows it, so an exporter that wants a space in the output puts it BEFORE
  // the break. A fixture with the space after the break is asserting that the
  // parser should insert one, which would be wrong — real exporters fold at 75
  // octets, mid-word, and a parser that added a space there would corrupt every
  // long name it touched.
  const VCF = [
    'BEGIN:VCARD', 'VERSION:3.0',
    'N:Example;Annie;;;', 'FN:Annie Example',
    'item1.TEL;type=CELL:+1 555 010 4477',
    'EMAIL;type=INTERNET:annie@example.com',
    'END:VCARD',
    'BEGIN:VCARD', 'VERSION:3.0',
    'FN:A Name Long Enough That The Exporter Wrapped ',
    ' It Across A Line',
    'TEL:+447700900123',
    'END:VCARD',
    'BEGIN:VCARD', 'VERSION:3.0', 'FN:No Handles', 'END:VCARD',
  ].join('\r\n')

  const vcf = fromVcard(VCF)
  if (vcf.contacts.length !== 2) {
    note(
      `vCard: parsed ${vcf.contacts.length} contacts, expected 2.`,
      `  got: ${JSON.stringify(vcf.contacts.map((c) => c.name))}`,
    )
  } else {
    if (vcf.contacts[0].handles.length !== 2) {
      note(
        'vCard: the item-prefixed TEL or the EMAIL was dropped.',
        `  handles: ${JSON.stringify(vcf.contacts[0].handles)}`,
      )
    }
    const folded = 'A Name Long Enough That The Exporter Wrapped It Across A Line'
    if (vcf.contacts[1].name !== folded) {
      note('vCard: a folded line was not unfolded.', `  got: ${JSON.stringify(vcf.contacts[1].name)}`)
    }
  }
  if (parseContacts('x.vcf', VCF).format !== 'vcard') note('parseContacts misread a .vcf as CSV.')
  if (parseContacts('x.csv', CSV_TRICKY).format !== 'google-csv') {
    note('parseContacts misread a .csv as vCard.')
  }

  // Finding by digits: the whole point is that a stored "+1 (555) 010-4477" is
  // found by typing 5550104477 — the same normalisation the SQL does.
  const found = findContacts(csv.contacts, '5550104477')
  if (!found.some((c) => c.name === 'Example, Annie')) {
    note(
      'findContacts did not match a formatted number by its digits.',
      `  got: ${JSON.stringify(found.map((c) => c.name))}`,
    )
  }

  /* ---- 1-3. every fixture ------------------------------------------------ */
  const queryFiles = []
  const wanted = []

  for (const fx of FIXTURES) {
    const mod = MODULES[fx.tool]
    if (!mod) {
      note(`fixture "${fx.name}" names an unregistered tool: ${fx.tool}`)
      continue
    }

    const [a, b] = composeTwice(mod, fx.answers)
    if (a.script !== b.script) {
      note(
        `"${fx.name}" is not deterministic — two composes differ.`,
        '  A clock or an unseeded iteration order got into compose().',
      )
      continue
    }
    if (!a.warnings.length) {
      note(`"${fx.name}" emitted no warnings.`, '  Every command in this room has something it cannot do. Say it.')
    }

    const goldenPath = join(GOLDEN, `${fx.name}.sh`)
    if (BLESS || !existsSync(goldenPath)) {
      writeFileSync(goldenPath, a.script + '\n')
    } else {
      const have = readFileSync(goldenPath, 'utf8').replace(/\n$/, '')
      if (have !== a.script) {
        note(
          `"${fx.name}" no longer matches its golden file.`,
          `  ${goldenPath}`,
          '  If the change is intended: npm run tool:check -- --bless',
        )
      }
    }

    // Does bash consider it a program at all? `-n` parses without running,
    // which catches the class of mistake that is invisible in a diff and fatal
    // on the reader's machine — an unterminated heredoc above all.
    // What actually runs is the INSIDE of the outer heredoc. Running `bash -n`
    // over the whole emitted block parses one line — `bash <<'IMSGX'` — and
    // treats every line after it as data, which is why the first version of
    // this check reported "valid bash" for a script whose inner heredoc never
    // terminated. The body is unwrapped first, so what is parsed is what runs.
    //
    // And the test is that bash says NOTHING, not that it exits clean: an
    // unterminated heredoc is a warning and a zero exit, and a warning still
    // reaches the reader on every run of their command.
    const inner = /^bash <<'IMSGX'\n([\s\S]*)\nIMSGX$/.exec(a.script)
    if (!inner) {
      note(`"${fx.name}" is not wrapped in the expected outer heredoc.`)
    } else {
      const scriptPath = join(GOLDEN, `.${fx.name}.sh`)
      writeFileSync(scriptPath, inner[1] + '\n')
      // spawnSync rather than execFileSync: the warning is on STDERR, and
      // execFileSync hands back stdout on success.
      const parsed = spawnSync('bash', ['-n', scriptPath], { encoding: 'utf8' })
      const said = `${parsed.stderr ?? ''}${parsed.stdout ?? ''}`.trim()
      if (parsed.status !== 0) {
        note(`"${fx.name}" is not valid bash.`, ...said.split('\n').map((l) => `  ${l}`))
      } else if (said) {
        note(
          `"${fx.name}": bash parsed it, but complained.`,
          ...said.split('\n').map((l) => `  ${l}`),
          '  A warning here reaches the reader on every run of the command.',
        )
      }
    }

    // Injection: the same fixture with every free-text answer poisoned.
    for (const nasty of NASTY) {
      const poisoned = { ...fx.answers }
      for (const key of ['home', 'handle']) {
        if (poisoned[key] !== undefined) poisoned[key] = nasty
      }
      let script
      try {
        script = mod.compose(poisoned).script
      } catch {
        // A tool refusing to emit is a valid answer to a hostile input.
        continue
      }
      // The outer delimiter must still open and close exactly once.
      const opens = (script.match(/<<'IMSGX'\n/g) ?? []).length
      const closes = script.split('\n').filter((l) => l.trimEnd() === 'IMSGX').length
      if (opens !== 1 || closes !== 1) {
        note(
          `"${fx.name}" with ${JSON.stringify(nasty)} broke the outer heredoc.`,
          `  ${opens} opener(s), ${closes} closer(s) — the payload escaped its quoting.`,
        )
        break
      }
    }

    // Collect the SQL for the run against a real database.
    for (const { marker, sql } of sqlBlocks(a.script)) {
      const path = join(GOLDEN, `.${fx.name}.${marker}.sql`)
      writeFileSync(path, sql)
      queryFiles.push(path)
      // A count query returns ONE row holding the number the row queries must
      // produce — it is the script's own reconciliation, and it was previously
      // skipped here, which meant the check that makes a truncated export loud
      // was itself unchecked.
      //
      // Matched on the marker's shape, not on one literal name. This read
      // `marker === 'SQL_COUNT'` until the script split its reconciliation into
      // a source count and a snapshot count taken either side of the copy. Both
      // new markers fell through to the row-query branch, where a
      // `SELECT COUNT(*)` was asked for nine rows and a contact_name column and
      // could only fail — twenty problems on six fixtures, none of them real,
      // and a red gate that held every deploy for three days. A gate keyed to a
      // list of the names it knows is a gate with an expiry date on it: every
      // count block the script can emit ends in COUNT, and no row query does.
      wanted.push(
        /COUNT$/.test(marker)
          ? { fixture: fx.name, marker, rows: 1, counts: fx.expect.rows }
          : { fixture: fx.name, marker, rows: fx.expect.rows, named: fx.expect.named },
      )
    }
  }

  /* ---- 4. run every query against a synthetic chat.db -------------------- */
  let results = []
  try {
    const raw = execFileSync('python3', [join(ROOT, 'scripts', 'tool-chatdb.py'), ...queryFiles], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    })
    results = JSON.parse(raw)
  } catch (err) {
    note(
      'Could not run the generated SQL against a synthetic chat.db.',
      `  ${String(err.stderr || err.message).trim().split('\n').slice(-4).join('\n  ')}`,
      '  This check needs python3 with the sqlite3 module — it ships with both.',
    )
  }

  results.forEach((result, i) => {
    const want = wanted[i]
    if (!want) return
    if (result.error) {
      note(
        `${want.fixture} / ${want.marker}: sqlite refused the generated query.`,
        `  ${result.error}`,
        '  Usually a column that is not in chat.db. See src/tool/tools/imessage/schema.ts.',
      )
      return
    }
    if (result.rows !== want.rows) {
      note(
        `${want.fixture} / ${want.marker}: returned ${result.rows} rows, expected ${want.rows}.`,
        '  The expectation is hand-computed from scripts/tool-chatdb.py. One of the two is wrong.',
      )
    }
    // A name that reaches the SQL but not the rows is the failure worth
    // catching: the CASE compiles either way, and an export full of blank names
    // reads as though the address book simply had no match for that person.
    if (want.counts !== undefined) {
      const got = (result.values[0] ?? [])[0]
      if (got !== want.counts) {
        note(
          `${want.fixture}: the script's own reconciliation counts ${got}, but the query returns ${want.counts}.`,
          '  The emitted command would refuse its own correct export as incomplete.',
        )
      }
    }
    if (want.named) {
      const at = result.columns?.indexOf('contact_name') ?? -1
      const stamped = at >= 0 && result.values.every((row) => row[at] === want.named)
      if (!stamped) {
        note(
          `${want.fixture} / ${want.marker}: contact_name is not "${want.named}" on every row.`,
          `  got: ${JSON.stringify((result.values[0] ?? [])[at] ?? null)}`,
        )
      }
    }
  })

  /* ---- 5. the attributedBody recovery, end to end ------------------------ */
  // The single most important check here, and the one the rest of the gate
  // cannot substitute for. The SQL and the python are pulled back OUT of an
  // emitted script — not imported from source — so what is tested is exactly
  // what a reader would paste, and they are run against three blob rows: a
  // short ASCII message, one over 127 bytes, and one with four-byte emoji.
  //
  // A decoder that reads the length prefix as a single byte passes the first
  // and fails the other two. Every casual test uses the first.
  const wide = MODULES.imessage.compose({
    home: '$HOME',
    target: 'everyone',
    window: 'all',
    format: 'csv',
  }).script

  const hexSql = /<<'SQL_HEX'[^\n]*\n([\s\S]*?)\nSQL_HEX$/m.exec(wide)
  const pySrc = /<<'PYSRC'[^\n]*\n([\s\S]*?)\nPYSRC$/m.exec(wide)

  if (!hexSql || !pySrc) {
    note('Could not find the query and the decoder inside an emitted script.',
         '  The precise text-recovery path is unreachable, and untested.')
  } else {
    const sqlPath = join(GOLDEN, '.decode.sql')
    const pyPath = join(GOLDEN, '.decode.py')
    writeFileSync(sqlPath, hexSql[1])
    writeFileSync(pyPath, pySrc[1])
    try {
      const raw = execFileSync(
        'python3',
        [join(ROOT, 'scripts', 'tool-chatdb.py'), '--decode', sqlPath, pyPath],
        { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
      )
      const run = JSON.parse(raw)
      if (run.error) {
        note('The emitted decoder failed to run.', ...run.error.split('\n').map((l) => `  ${l}`))
      } else {
        if (run.header_has_body_hex) {
          note('The decoder left the raw body_hex column in the export.',
               '  That is the blob, not the text, and it belongs nowhere near the reader.')
        }
        for (const key of Object.keys(run.want)) {
          if (run.texts[key] !== run.want[key]) {
            const label =
              key === '8' ? 'the message over 127 bytes' :
              key === '9' ? 'the message with emoji in it' : 'the short message'
            note(
              `attributedBody recovery is wrong for ${label} (row ${key}).`,
              `  got:    ${JSON.stringify((run.texts[key] || '').slice(0, 72))}`,
              `  wanted: ${JSON.stringify(run.want[key].slice(0, 72))}`,
              '  This is almost always the variable-width length prefix — see body.ts.',
            )
          }
        }
      }
    } catch (err) {
      note('Could not run the emitted decoder.',
           `  ${String(err.stderr || err.message).trim().split('\n').slice(-3).join('\n  ')}`)
    }
  }

  /* ---- report ----------------------------------------------------------- */
  if (fail.length) {
    console.error('')
    console.error(`THE TOOL — ${fail.length} problem${fail.length === 1 ? '' : 's'}:`)
    console.error('')
    for (const lines of fail) for (const line of lines) console.error(line)
    console.error('')
    process.exit(1)
  }

  console.log(`THE TOOL — ${FIXTURES.length} fixtures, ${queryFiles.length} queries run against a synthetic chat.db`)
  console.log('  deterministic, golden, valid bash, injection-safe, every column resolves')
  console.log('  attributedBody recovered exactly, including >127 bytes and emoji')
  console.log('  contacts parsed from Google CSV and vCard, quoting and folding included')
  console.log('  each script reconciles to its own row count, and bash parses it silently')
}

main()
