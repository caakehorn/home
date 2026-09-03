/**
 * Runs a real generated command, end to end, against a fixture database.
 *
 *   node scripts/tool-smoke.mjs            (also runs inside `npm run tool:check`)
 *
 * ---- why this exists ------------------------------------------------------
 *
 * Everything else in the gate checks a PART of the deliverable: that the SQL
 * returns the right rows, that bash parses the script, that the decoder
 * recovers the text. All of those passed while the tool was writing exports
 * containing zero messages, because the thing that was broken — a relative
 * window whose predicate was always false — was only exercised by a fixture
 * that expected nothing back.
 *
 * The only check that could not have missed it is the one that runs the whole
 * command and reads the file that lands. So: a temporary HOME with a Messages
 * database under it, macOS's absolute paths shimmed, and then the emitted
 * script executed exactly as a reader would paste it. It passes when the file
 * on the Desktop has the rows in it.
 *
 * ---- what is shimmed, and what that costs ---------------------------------
 *
 * `/usr/bin/sqlite3` becomes a small python adapter (the same engine, three
 * flags); `open` becomes a no-op, because there is no Finder here. Nothing
 * else is touched — the script's own logic, its snapshot, its decoder choice,
 * its reconciliation and its manifest all run for real.
 *
 * What it therefore cannot prove: that Full Disk Access behaves as described,
 * that `open -R` reveals the file, or that a genuine chat.db from a genuine
 * Mac has the shape this fixture does. Those need a Mac. Everything up to them
 * is covered here.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bundle } from './build-tool-entry.mjs'

const ROOT = process.cwd()

/** The cases worth running whole. Kept short — this is slower than the rest. */
const RUNS = [
  {
    name: 'everyone, last 90 days, csv',
    answers: { home: 'HOME_PLACEHOLDER', target: 'everyone', window: 'rel:90:days', format: 'csv' },
    rows: 3,
    contains: ['two days ago', 'five days ago, no handle'],
  },
  {
    name: 'an Apple ID thread, everything, csv',
    answers: {
      home: 'HOME_PLACEHOLDER',
      target: 'appleid',
      handle: 'recent@example.com',
      scope: 'conversation',
      window: 'all',
      format: 'csv',
    },
    rows: 3,
    contains: ['ten days ago'],
  },
  {
    name: 'a phone number, everything, txt',
    answers: {
      home: 'HOME_PLACEHOLDER',
      target: 'number',
      handle: '+1 (555) 010-4477',
      scope: 'conversation',
      window: 'all',
      format: 'txt',
    },
    rows: 9,
    contains: ['the old encoding', 'in two chats'],
    // Only when the machine had a python3 to reach: on the fallback path these
    // come back approximate by design, and asserting them there would be
    // asserting that the documented limitation does not exist.
    containsWhenExact: ['group hello', 'four bytes each'],
  },
]

export async function smoke() {
  const problems = []
  const entryPath = await bundle()
  const { MODULES } = await import(`file://${entryPath}`)

  const work = mkdtempSync(join(tmpdir(), 'tool-smoke-'))
  const home = join(work, 'home')
  const bin = join(work, 'bin')
  mkdirSync(join(home, 'Library', 'Messages'), { recursive: true })
  mkdirSync(join(home, 'Desktop'), { recursive: true })
  mkdirSync(bin, { recursive: true })

  // The fixture database, built by the same script the rest of the gate uses.
  execFileSync('python3', [join(ROOT, 'scripts', 'tool-chatdb.py'), '--write',
    join(home, 'Library', 'Messages', 'chat.db')], { encoding: 'utf8' })

  // `open` has nothing to do here, and must not fail the script under `set -e`.
  writeFileSync(join(bin, 'open'), '#!/bin/bash\nexit 0\n')
  chmodSync(join(bin, 'open'), 0o755)

  // The emitted script calls /usr/bin/sqlite3 by absolute path on purpose — it
  // must not pick up whatever happens to be first on a reader's PATH. So a
  // real one there is used as-is (macOS and most Linux images have one), and
  // only a machine without one gets the python shim, which is then removed
  // again however this ends.
  const shimTarget = '/usr/bin/sqlite3'
  const real = existsSync(shimTarget)
  let placed = false
  if (!real) {
    try {
      writeFileSync(shimTarget, readFileSync(join(ROOT, 'scripts', 'tool-sqlite3-shim.py')))
      chmodSync(shimTarget, 0o755)
      placed = true
    } catch {
      // Not a failure. A machine that can neither provide sqlite3 nor be given
      // one cannot run this check, and turning that into a red build would
      // mean the gate failing for a property of the runner rather than of the
      // code. The rest of the gate — which is most of it — still ran.
      console.warn('  (smoke test skipped: no /usr/bin/sqlite3, and none could be placed)')
      rmSync(work, { recursive: true, force: true })
      return []
    }
  }

  try {
    for (const run of RUNS) {
      const answers = { ...run.answers, home }
      const script = MODULES.imessage.compose(answers).script
      const path = join(work, 'run.sh')
      writeFileSync(path, script)

      const out = spawnSync('bash', [path], {
        encoding: 'utf8',
        env: { ...process.env, HOME: home, PATH: `${bin}:${process.env.PATH}` },
        timeout: 120000,
      })
      const said = `${out.stdout ?? ''}${out.stderr ?? ''}`

      if (out.status !== 0) {
        problems.push([
          `SMOKE "${run.name}": the command exited ${out.status}.`,
          ...said.trim().split('\n').slice(-8).map((l) => `  ${l}`),
        ])
        continue
      }
      if (said.includes('warning:')) {
        problems.push([
          `SMOKE "${run.name}": the command printed a warning.`,
          ...said.split('\n').filter((l) => l.includes('warning:')).map((l) => `  ${l}`),
        ])
      }

      const desk = readdirSync(join(home, 'Desktop'))
      const written = desk.filter((f) => !f.includes('manifest'))
      if (!written.length) {
        problems.push([`SMOKE "${run.name}": nothing landed on the Desktop.`])
        continue
      }
      const body = readFileSync(join(home, 'Desktop', written[0]), 'utf8')
      const manifest = readFileSync(
        join(home, 'Desktop', desk.find((f) => f.includes('manifest'))),
        'utf8',
      )

      // The manifest's own count is what a reader reads, so it is what is
      // asserted — the export that started all this said "messages 0".
      const stated = /messages\s+(\d+)/.exec(manifest)
      const got = stated ? Number(stated[1]) : -1
      if (got !== run.rows) {
        problems.push([
          `SMOKE "${run.name}": the manifest says ${got} messages, expected ${run.rows}.`,
          '  This is the check that reads what the reader reads.',
        ])
      }
      const exact = /text recovery\s+exact/.test(manifest)
      const wanted = [...run.contains, ...(exact ? (run.containsWhenExact ?? []) : [])]
      for (const want of wanted) {
        if (!body.includes(want)) {
          problems.push([
            `SMOKE "${run.name}": the export does not contain ${JSON.stringify(want)}.`,
            '  The rows were counted but the text did not survive to the file.',
          ])
        }
      }
      for (const f of desk) rmSync(join(home, 'Desktop', f))
    }
  } finally {
    if (placed) rmSync(shimTarget, { force: true })
    rmSync(work, { recursive: true, force: true })
  }

  return problems
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = await smoke()
  for (const lines of problems) for (const line of lines) console.error(line)
  console.log(problems.length ? `${problems.length} problem(s)` : `${RUNS.length} commands ran end to end`)
  process.exit(problems.length ? 1 : 0)
}
