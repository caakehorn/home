/**
 * Getting the text out of a message whose text column is empty.
 *
 * On Ventura and later a great many rows in chat.db have `message.text` NULL
 * and the actual words in `message.attributedBody` — an NSKeyedArchiver-encoded
 * NSAttributedString, which is to say a binary plist. Any export that reads
 * only `text` on a modern Mac comes back mostly blank, and comes back blank
 * quietly, which is worse.
 *
 * There are two ways out of it and this tool ships both, because which one is
 * available depends on a machine nobody here can inspect.
 *
 * ---- the precise one: python3 ----------------------------------------------
 *
 * macOS ships /usr/bin/python3. Where it runs, `PY_DECODER` below finds the
 * NSString marker, reads the length prefix, and decodes exactly that many bytes
 * as UTF-8.
 *
 * The length prefix is the part that is easy to get wrong and is wrong in
 * shipped implementations: it is VARIABLE WIDTH. A byte under 0x81 is the
 * length itself; 0x81 means the next two bytes are a little-endian length; 0x82
 * means the next four. Reading it as a fixed single byte works on every short
 * ASCII message anybody tests with and then truncates every message over 127
 * bytes, and mangles anything with an emoji in it — which is to say it fails on
 * exactly the messages a person cares about and passes on the ones they check.
 *
 * ---- the approximate one: sqlite alone -------------------------------------
 *
 * Where python3 is not there, `SQLITE_TEXT_GUESS` does what can be done in SQL:
 * cast the blob to text, find the marker, slice, and trim the archive bytes off
 * the ends. It works for short ASCII. It mangles emoji, and sqlite's text
 * functions stop at an embedded NUL, so a blob with one in it gives back a
 * short answer rather than an error.
 *
 * This is a real difference in the quality of the export, so the emitted script
 * says which path it took, in the terminal AND in the manifest beside the file.
 * The reader finds out from the tool, not from noticing months later that the
 * long messages are missing.
 *
 * ---- what neither of them does ---------------------------------------------
 *
 * Neither recovers formatting, inline images, link previews, or the text of a
 * message Apple stored some third way. `attributedBody` is an attributed
 * string; this takes the string and drops the attributes.
 */

/**
 * The in-SQL approximation. One expression, substituted into the SELECT.
 *
 * `NSString` is eight bytes; what follows it is a short run of archiver bytes
 * and then the text. The slice starts past both, then `ltrim` removes whatever
 * control bytes are actually there — the run length varies between macOS
 * versions, so trimming a character class is more durable than skipping a
 * fixed count. The trailing cut is at the next archiver class name, which is
 * where the string ends when the trailer did not survive the cast.
 */
export const SQLITE_TEXT_GUESS = `(
    SELECT
      CASE
        WHEN instr(body, 'NSDictionary') > 1 THEN substr(body, 1, instr(body, 'NSDictionary') - 1)
        WHEN instr(body, 'NSAttributeInfo') > 1 THEN substr(body, 1, instr(body, 'NSAttributeInfo') - 1)
        ELSE body
      END
    FROM (
      SELECT rtrim(ltrim(
        substr(
          CAST(m.attributedBody AS TEXT),
          instr(CAST(m.attributedBody AS TEXT), 'NSString') + 8
        ),
        char(1) || char(2) || char(3) || char(4) || char(5) || char(6) || char(7) ||
        char(8) || char(11) || char(12) || char(14) || char(15) || char(16) ||
        char(43) || char(129) || char(130) || char(132) || char(134) || char(148)
      ),
        char(1) || char(2) || char(6) || char(11) || char(12) || char(16) || char(134)
      ) AS body
    )
  )`

/**
 * The precise decoder, and the whole of the output stage.
 *
 * It is one file because it is one pass: the same walk that recovers the text
 * also writes the final CSV or TXT, so there is no intermediate file holding
 * half-decoded rows and nothing to clean up if it dies. It reports its counts
 * on stderr, which the emitted script prints and writes into the manifest.
 *
 * Kept as a string rather than a .py file in `public/` on purpose. The whole
 * promise of this room is that the reader pastes ONE thing; a script that
 * fetched a second file at run time would be a second thing, would need the
 * network, and would need them to trust a URL as well as a command they can
 * read in front of them.
 */
export const PY_DECODER = String.raw`
import csv, sys

# NSKeyedArchiver stores the string with a variable-width length prefix. See
# the note in body.ts: reading this as one byte truncates anything over 127
# bytes and mangles emoji, which is the failure that passes every casual test.
def _read_len(b, k):
    n = b[k]
    if n == 0x81:
        return int.from_bytes(b[k + 1:k + 3], 'little'), k + 3
    if n == 0x82:
        return int.from_bytes(b[k + 1:k + 5], 'little'), k + 5
    if n == 0x83:
        return int.from_bytes(b[k + 1:k + 9], 'little'), k + 9
    return n, k + 1

def decode(hexed):
    if not hexed:
        return None
    try:
        b = bytes.fromhex(hexed)
    except ValueError:
        return None
    # The class name can appear more than once in the archive's object table,
    # so every occurrence is tried and the first plausible one wins rather than
    # the first one found.
    for name in (b'NSString', b'NSMutableString'):
        at = -1
        while True:
            at = b.find(name, at + 1)
            if at < 0:
                break
            head = at + len(name)
            # The 0x2B marker follows within a short run of archiver bytes.
            # Bounded rather than open-ended: an unbounded search finds a '+'
            # inside the message text of some other field.
            mark = b.find(b'\x2b', head, head + 24)
            if mark < 0:
                continue
            n, start = _read_len(b, mark + 1)
            if n <= 0 or start + n > len(b):
                continue
            try:
                return b[start:start + n].decode('utf-8')
            except UnicodeDecodeError:
                # A length that decodes to nothing sensible is a length read at
                # the wrong offset. Try the next occurrence rather than
                # returning mojibake.
                continue
    return None

mode, src, dst = sys.argv[1], sys.argv[2], sys.argv[3]

with open(src, newline='', encoding='utf-8', errors='replace') as fh:
    rows = list(csv.reader(fh))

if not rows:
    sys.stderr.write('0 0 0\n')
    sys.exit(0)

head = rows[0]
i_text = head.index('text')
i_hex = head.index('body_hex')
keep = [i for i in range(len(head)) if i != i_hex]

recovered = 0
unrecovered = 0
for r in rows[1:]:
    if len(r) <= i_hex:
        continue
    if not r[i_text] and r[i_hex]:
        got = decode(r[i_hex])
        if got is None:
            unrecovered += 1
        else:
            r[i_text] = got
            recovered += 1

i_when = head.index('sent_at_local')
i_dir = head.index('direction')
i_who = head.index('counterparty')
i_name = head.index('contact_name')
i_svc = head.index('service')
i_chat = head.index('chat_name')
i_att = head.index('attachments')

with open(dst, 'w', newline='', encoding='utf-8') as out:
    if mode == 'csv':
        w = csv.writer(out, quoting=csv.QUOTE_MINIMAL)
        for r in rows:
            w.writerow([r[i] for i in keep] if len(r) > i_hex else r)
    else:
        for r in rows[1:]:
            if len(r) <= i_hex:
                continue
            who = r[i_name] or r[i_who] or 'unknown'
            if r[i_dir] == 'SENT':
                line = 'me -> ' + who
            else:
                line = who + ' -> me'
            tail = ' [' + r[i_svc] + ']' if r[i_svc] else ''
            if r[i_chat]:
                tail = ' [' + r[i_chat] + ']' + tail
            out.write(r[i_when] + '  ' + line + tail + '\n')
            body = r[i_text]
            if body:
                for ln in body.split('\n'):
                    out.write('    ' + ln + '\n')
            if r[i_att]:
                out.write('    <attachment: ' + r[i_att] + '>\n')
            out.write('\n')

sys.stderr.write('%d %d %d\n' % (len(rows) - 1, recovered, unrecovered))
`.trim()
