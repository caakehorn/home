/**
 * The block the reader pastes.
 *
 * The promise is ONE PASTE. The generated shell script checks access, snapshots
 * Messages' SQLite database including WAL state, exports rows, decodes modern
 * attributedBody payloads when Python is available, and verifies the row count.
 */

import { sh, heredoc, slug } from '../../shell/quote'
import { PY_DECODER } from './body'
import { buildQuery, buildCount } from './sql'
import type { QueryPlan } from './sql'
import { describeRange } from '../../shell/dates'

export type Format = 'csv' | 'txt'

export type ScriptPlan = QueryPlan & {
  format: Format
  home: string
  label: string
}

function homeExpr(raw: string): string {
  const value = raw.trim()
  if (!value || value === '$HOME' || value === '~') return '"$HOME"'
  if (value.startsWith('/')) return sh(value.replace(/\/+$/, ''))
  return sh(`/Users/${value.replace(/^\/+|\/+$/g, '')}`)
}

function txtWrapper(inner: string): string {
  const body = inner.replace(/;\s*$/, '')
  return `WITH rows AS (
${body}
)
SELECT
  sent_at_local || '  ' ||
  CASE direction
    WHEN 'SENT' THEN 'me -> ' || COALESCE(NULLIF(contact_name, ''), counterparty, 'unknown')
    ELSE COALESCE(NULLIF(contact_name, ''), counterparty, 'unknown') || ' -> me'
  END ||
  CASE WHEN chat_name <> '' THEN ' [' || chat_name || ']' ELSE '' END ||
  CASE WHEN service <> '' THEN ' [' || service || ']' ELSE '' END ||
  char(10) || '    ' || replace(COALESCE(text, ''), char(10), char(10) || '    ') ||
  CASE WHEN attachments <> '' THEN char(10) || '    <attachment: ' || attachments || '>' ELSE '' END
FROM rows;`
}

export const outputName = (plan: ScriptPlan) => `imessage-${slug(plan.label, 'export')}`

export function buildScript(plan: ScriptPlan): string {
  const home = homeExpr(plan.home)
  const name = outputName(plan)
  const ext = plan.format

  const withHex = buildQuery(plan, true)
  const plain = buildQuery(plan, false)
  const count = buildCount(plan)
  const plainOut = plan.format === 'txt' ? txtWrapper(plain) : plain

  const body = `#!/bin/bash
set -euo pipefail

HOME_DIR=${home}
DB="$HOME_DIR/Library/Messages/chat.db"
DESK="$HOME_DIR/Desktop"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$DESK/${name}-$STAMP.${ext}"
MANIFEST="$DESK/${name}-$STAMP.manifest.txt"

say() { printf '%s\\n' "$*"; }

say "EXTRACT IMESSAGE"
say "  database  $DB"
say "  output    $OUT"
say ""

if [ ! -f "$DB" ]; then
  say "No Messages database at:"
  say "  $DB"
  say ""
  say "Either this is the wrong home directory, or Messages has never been signed in on this Mac."
  say "Check the short username with: echo \\$HOME"
  exit 1
fi

if ! /usr/bin/sqlite3 "$DB" 'SELECT 1;' >/dev/null 2>&1; then
  say "macOS is blocking access to the Messages database."
  say "Grant Full Disk Access to this terminal app, quit it completely, then reopen it."
  say "System Settings > Privacy & Security > Full Disk Access"
  open "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles" 2>/dev/null || true
  exit 1
fi

# Count before copying. This distinguishes a genuinely empty selection from a
# broken snapshot/export path.
SOURCE_EXPECT="$(/usr/bin/sqlite3 "$DB" ${heredoc('SQL_SOURCE_COUNT', count)}
)"
if ! [[ "$SOURCE_EXPECT" =~ ^[0-9]+$ ]]; then
  say "Could not count matching messages in the source database."
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp "$DB" "$WORK/chat.db"
if [ -f "$DB-wal" ]; then cp "$DB-wal" "$WORK/chat.db-wal"; fi
if [ -f "$DB-shm" ]; then cp "$DB-shm" "$WORK/chat.db-shm"; fi

# Make the copied WAL visible before querying the snapshot. The previous tool
# copied the files but could query a snapshot that did not actually see the WAL.
/usr/bin/sqlite3 "$WORK/chat.db" 'PRAGMA wal_checkpoint(TRUNCATE);' >/dev/null 2>&1 || true
SNAP_EXPECT="$(/usr/bin/sqlite3 "$WORK/chat.db" ${heredoc('SQL_SNAPSHOT_COUNT', count)}
)"
if ! [[ "$SNAP_EXPECT" =~ ^[0-9]+$ ]]; then
  say "Could not count matching messages in the database snapshot."
  exit 1
fi
if [ "$SNAP_EXPECT" != "$SOURCE_EXPECT" ]; then
  say "MISMATCH: source database has $SOURCE_EXPECT matching messages, but the snapshot has $SNAP_EXPECT."
  say "No export written. Messages changed while the database was being copied; run it again."
  exit 1
fi

PY=""
for cand in /opt/homebrew/bin/python3 /usr/local/bin/python3; do
  if [ -x "$cand" ]; then PY="$cand"; break; fi
done
if [ -z "$PY" ] && /usr/bin/xcode-select -p >/dev/null 2>&1 && [ -x /usr/bin/python3 ]; then
  PY="/usr/bin/python3"
fi

RECOVERY="approximate (sqlite only)"
WROTE="unknown"

if [ -n "$PY" ]; then
  say "Reading, with full text recovery ($PY)…"
  /usr/bin/sqlite3 -csv -header "$WORK/chat.db" > "$WORK/raw.csv" ${heredoc('SQL_HEX', withHex)}
  cat > "$WORK/decode.py" ${heredoc('PYSRC', PY_DECODER)}

  STATS="$("$PY" "$WORK/decode.py" ${sh(plan.format)} "$WORK/raw.csv" "$OUT" 2>&1 >/dev/null)"
  WROTE="$(printf '%s' "$STATS" | awk '{print $1}')"
  GOT="$(printf '%s' "$STATS" | awk '{print $2}')"
  MISSED="$(printf '%s' "$STATS" | awk '{print $3}')"
  RECOVERY="exact (byte-parsed; $GOT recovered from attributedBody, $MISSED not recoverable)"
else
  say "Reading. No python3 on this Mac, so text recovery is approximate…"
  /usr/bin/sqlite3 -csv -header "$WORK/chat.db" > "$OUT" ${heredoc('SQL_PLAIN', plainOut)}
fi

if [ "$WROTE" = "unknown" ]; then
${
  plan.format === 'csv'
    ? `  WROTE="$(awk 'BEGIN{q=0;n=0} { c=gsub(/"/,"&"); q=(q+c)%2; if(q==0) n++ } END{print n-1}' "$OUT")"`
    : `  WROTE="$(grep -c '^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] ' "$OUT" || true)"`
}
fi

if ! [[ "$WROTE" =~ ^[0-9]+$ ]]; then
  say "The decoder did not report a valid message count."
  exit 1
fi

if [ "$WROTE" != "$SNAP_EXPECT" ]; then
  say "MISMATCH: the database snapshot has $SNAP_EXPECT matching messages, but $WROTE were written."
  say "The export at $OUT is incomplete. Not opening it."
  exit 1
fi

{
  say "EXTRACT IMESSAGE — what this file is"
  say ""
  say "taken          $(date '+%Y-%m-%d %H:%M:%S %z')"
  say "from           $DB"
  say "messages       $WROTE"
  say "who            ${plan.targets.length ? plan.targets.map((t) => t.name ? `${t.name} <${t.handle}>` : t.handle).join(', ').replace(/"/g, "'") : 'everybody in the database'}"
  say "scope          ${plan.scope === 'conversation' ? 'whole conversations, including group threads' : 'messages to and from that handle only'}"
  say "window         ${describeRange(plan.range)}"
  say "text recovery  $RECOVERY"
  say ""
  say "Timestamps are this Mac's local time. sent_epoch is seconds since 1970."
  say "Attachment FILES are not copied — only their names are recorded."
  say "Formatting, link previews and inline images are not recovered."
} > "$MANIFEST"

say ""
say "Done. $WROTE messages."
say "  $OUT"
say "  $MANIFEST"
open -R "$OUT" 2>/dev/null || true
`

  return `bash ${heredoc('IMSGX', body.trim())}`
}
