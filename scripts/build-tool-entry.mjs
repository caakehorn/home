/**
 * Bundles `src/tool/check-entry.ts` so the build gate can run a tool's real
 * `compose` from Node.
 *
 *   node scripts/build-tool-entry.mjs
 *
 * Not a payload build — nothing here is shipped. It exists because Node's
 * type-stripping resolver will not follow this codebase's extensionless
 * imports, and because a gate that re-implemented `compose` would assert only
 * that two copies of the same mistake agree. Vite is already a dependency and
 * is the same resolver the site is built with, so the code the gate checks is
 * the code the site ships.
 *
 * The output goes under node_modules/ rather than into the tree: it is a build
 * artifact of a check, it is regenerated every run, and it must never be
 * something a reader can mistake for source.
 */

import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'vite'

export const OUT_DIR = join(process.cwd(), 'node_modules', '.tool-check')
export const OUT_FILE = join(OUT_DIR, 'entry.mjs')

export async function bundle() {
  rmSync(OUT_DIR, { recursive: true, force: true })
  await build({
    logLevel: 'error',
    configFile: false,
    build: {
      outDir: OUT_DIR,
      emptyOutDir: true,
      ssr: true,
      target: 'node22',
      minify: false,
      rollupOptions: {
        input: join(process.cwd(), 'src', 'tool', 'check-entry.ts'),
        output: { entryFileNames: 'entry.mjs', format: 'es' },
      },
    },
  })
  return OUT_FILE
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await bundle()
  console.log(OUT_FILE)
}
