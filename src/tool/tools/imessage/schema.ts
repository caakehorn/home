/**
 * The parts of chat.db this tool actually reads.
 *
 * Written down in one place for two reasons. It is the thing a reader is
 * entitled to see before running a command against their own message history —
 * "it reads these eight tables and these columns, and nothing else" is a
 * checkable claim, and a paragraph of prose is not. And it is what lets the
 * build gate catch the failure a typecheck cannot: a mistyped column name is
 * valid TypeScript, valid SQL syntax, and fails only on a Mac none of us has.
 * `scripts/check-tool.mjs` builds a database from exactly this and runs the
 * generated query against it, so a column that drifts out of the query and a
 * column that drifts out of this file cannot drift apart silently.
 *
 * ---- what this is not ------------------------------------------------------
 *
 * Not the real schema. chat.db has around thirty tables and the message table
 * alone has upwards of eighty columns, most of them Apple's business. This is
 * the subset the query touches, with the types sqlite will report for them.
 * Apple has changed this schema before and will again; if a column here stops
 * existing, the generated command fails loudly on the reader's machine with
 * sqlite's own error, which is the correct outcome and the reason the query is
 * never wrapped in something that would swallow it.
 */

export type Column = { name: string; type: string; note?: string }

export const SCHEMA: { table: string; why: string; columns: Column[] }[] = [
  {
    table: 'message',
    why: 'One row per message. The text, the direction, and the timestamps.',
    columns: [
      { name: 'ROWID', type: 'INTEGER PRIMARY KEY' },
      { name: 'guid', type: 'TEXT', note: 'stable across devices; what replies point at' },
      {
        name: 'date',
        type: 'INTEGER',
        note: 'Apple epoch — nanoseconds since 2001-01-01 on High Sierra and later, SECONDS before it',
      },
      { name: 'date_read', type: 'INTEGER', note: 'same encoding; 0 when never read' },
      { name: 'is_from_me', type: 'INTEGER', note: '1 sent, 0 received' },
      { name: 'is_read', type: 'INTEGER' },
      { name: 'handle_id', type: 'INTEGER', note: 'the OTHER party, in both directions' },
      { name: 'service', type: 'TEXT', note: 'iMessage or SMS' },
      { name: 'text', type: 'TEXT', note: 'NULL on Ventura and later for a great many rows' },
      {
        name: 'attributedBody',
        type: 'BLOB',
        note: 'NSKeyedArchiver NSAttributedString — where the text went',
      },
      { name: 'cache_has_attachments', type: 'INTEGER' },
      { name: 'associated_message_type', type: 'INTEGER', note: 'non-zero on a tapback' },
      { name: 'associated_message_guid', type: 'TEXT', note: 'what the tapback is on' },
      { name: 'thread_originator_guid', type: 'TEXT', note: 'set when this is an inline reply' },
    ],
  },
  {
    table: 'handle',
    why: 'The other end of a conversation: a phone number or an Apple ID.',
    columns: [
      { name: 'ROWID', type: 'INTEGER PRIMARY KEY' },
      {
        name: 'id',
        type: 'TEXT',
        note: 'E.164 for SMS/iMessage numbers, a bare email for Apple IDs — and inconsistently formatted',
      },
      { name: 'service', type: 'TEXT' },
    ],
  },
  {
    table: 'chat',
    why: 'The conversation a message belongs to, and whether it is a group.',
    columns: [
      { name: 'ROWID', type: 'INTEGER PRIMARY KEY' },
      { name: 'chat_identifier', type: 'TEXT' },
      { name: 'display_name', type: 'TEXT', note: 'only groups that were named have one' },
      { name: 'style', type: 'INTEGER', note: '43 = group, 45 = one to one' },
      { name: 'service_name', type: 'TEXT' },
    ],
  },
  {
    table: 'chat_message_join',
    why: 'Which conversation each message is in. A message can be in more than one.',
    columns: [
      { name: 'chat_id', type: 'INTEGER' },
      { name: 'message_id', type: 'INTEGER' },
    ],
  },
  {
    table: 'chat_handle_join',
    why: 'Who is in each conversation. This is what makes a group export possible.',
    columns: [
      { name: 'chat_id', type: 'INTEGER' },
      { name: 'handle_id', type: 'INTEGER' },
    ],
  },
  {
    table: 'attachment',
    why: 'Filenames of what was sent alongside. The files themselves are not exported.',
    columns: [
      { name: 'ROWID', type: 'INTEGER PRIMARY KEY' },
      { name: 'transfer_name', type: 'TEXT' },
      { name: 'mime_type', type: 'TEXT' },
    ],
  },
  {
    table: 'message_attachment_join',
    why: 'Which attachments belong to which message.',
    columns: [
      { name: 'message_id', type: 'INTEGER' },
      { name: 'attachment_id', type: 'INTEGER' },
    ],
  },
]

/** Every column, as `table.column`, for the gate to diff against the query. */
export const COLUMNS: string[] = SCHEMA.flatMap((t) => t.columns.map((c) => `${t.table}.${c.name}`))

/**
 * The Apple-epoch conversion, as one SQL expression.
 *
 * Two encodings live in this column. Everything written by High Sierra and
 * later is nanoseconds since 2001-01-01; everything older is seconds since the
 * same instant. A database that has been migrated forward across that boundary
 * — which is most databases of any age — contains both, so a query that assumes
 * either one silently dates a decade of messages to 1970 or to the far future.
 *
 * The threshold is 1e12: a nanosecond value for any plausible date is ~7.8e17,
 * and a seconds value is ~7.8e8, so there is eight orders of magnitude of
 * daylight between them and nothing real lands near the line.
 *
 * Verified: 750000000000000000 → 2024-10-07 in local time.
 */
export const appleEpoch = (col: string) =>
  `(CASE WHEN ${col} > 1000000000000 THEN ${col} / 1000000000 ELSE ${col} END + 978307200)`
