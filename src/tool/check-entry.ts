/**
 * What `scripts/check-tool.mjs` imports.
 *
 * The gate has to run a tool's real `compose` — a re-implementation of it in the
 * checker would only ever assert that two copies of the same mistake agree. But
 * Node cannot load this codebase's TypeScript directly: the imports are
 * extensionless, which its type-stripping resolver will not follow. So the
 * checker bundles this one file with Vite — already a dependency, and the same
 * resolver the site itself is built with — and imports the result.
 *
 * Everything reachable from here must be free of React and of the DOM. That is
 * not an inconvenience, it is the point: a deliverable that could only be
 * produced inside a browser could only be checked inside one.
 *
 * A new tool adds itself to MODULES. That is the whole of its obligation here.
 */

import type { ToolModule } from './core'
import { TOOLS } from './core'
import { imessage } from './tools/imessage/module'
import { COLUMNS, SCHEMA } from './tools/imessage/schema'
import { sh, sq, slug, heredoc } from './shell/quote'
import { parseRange, encodeRange, parseDay } from './shell/dates'
import { fromGoogleCsv, fromVcard, parseContacts, parseCsv, findContacts } from './tools/imessage/contacts'

export const MODULES: Record<string, ToolModule> = {
  imessage,
}

export { TOOLS, SCHEMA, COLUMNS, sh, sq, slug, heredoc, parseRange, encodeRange, parseDay }
export { fromGoogleCsv, fromVcard, parseContacts, parseCsv, findContacts }
