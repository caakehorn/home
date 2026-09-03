"""
Builds a synthetic chat.db and runs a generated query against it.

    python3 scripts/tool-chatdb.py <query-file> [<query-file> ...]

Used by `npm run tool:check`. The point is the check a typecheck cannot make:
a mistyped column name is valid TypeScript and valid SQL syntax, and fails only
on a Mac none of us has. Here it fails in CI.

---- what is in the fixture database ---------------------------------------

Small, and every row is there to catch something specific:

  * The SAME PERSON under two handles — +15550104477 and 5550104477 — because
    that is what a real database looks like after a few years and two devices,
    and a matcher that compares strings splits them into two people.
  * A message stored in SECONDS Apple-epoch alongside messages stored in
    nanoseconds, because a database of any age contains both and a query that
    assumes one dates the other to 1970 or to the far future.
  * A message in TWO chats, because the join multiplies rows and a duplicated
    export looks exactly like a correct one.
  * A message with TWO attachments, for the same reason.
  * RECENT messages, dated against the wall clock at fixture time. Without
    them every relative-window fixture expects zero rows, and an expectation of
    zero cannot tell "correctly filtered everything out" from "the predicate is
    always false". That is not hypothetical: `strftime` returns TEXT and SQLite
    orders every INTEGER before every TEXT, so an unCAST `epoch >= strftime(..)`
    is always FALSE — and this gate passed it, green, because the only fixture
    that exercised it expected nothing back.
  * An APPLE-ID-ONLY THREAD (chat 5) with no chat_handle_join row at all, and
    one message in it whose handle_id points nowhere. It is reachable only
    through chat.chat_identifier. A scope predicate that goes solely through
    the participants table returns nothing for it.
  * Three messages with a NULL text column and the words in attributedBody:
    one short and ASCII, one over 127 bytes, and one with an emoji. The last
    two are the ones that catch a length prefix read at the wrong byte width —
    the bug that passes every casual test because every casual test uses a
    short ASCII message.

Times are fixed and the whole run is forced to UTC, so `localtime` in the query
resolves identically on every machine.
"""

import json
import os
import sqlite3
import sys
import tempfile
import time

os.environ['TZ'] = 'UTC'

APPLE = 978307200


def ns(unix_seconds):
    """A modern Apple-epoch timestamp: nanoseconds since 2001-01-01."""
    return (unix_seconds - APPLE) * 1_000_000_000


def secs(unix_seconds):
    """A pre-High-Sierra Apple-epoch timestamp: seconds since 2001-01-01."""
    return unix_seconds - APPLE


# Dated against the wall clock on purpose: a relative window is resolved by
# sqlite at run time, so the only way to test one is with rows that are
# genuinely recent right now.
NOW = int(time.time())
DAY = 86400


def days_ago(n):
    return ns(NOW - n * DAY)


def attributed(text):
    """
    An attributedBody blob shaped like the ones NSKeyedArchiver actually
    writes, with the variable-width length prefix that is the whole difficulty.
    """
    raw = text.encode('utf-8')
    if len(raw) < 0x81:
        length = bytes([len(raw)])
    elif len(raw) <= 0xFFFF:
        length = b'\x81' + len(raw).to_bytes(2, 'little')
    else:
        length = b'\x82' + len(raw).to_bytes(4, 'little')
    return (
        b'\x04\x0bstreamtyped\x81\xe8\x03\x84\x01\x40\x84\x84\x84'
        b'\x12NSAttributedString\x00\x84\x84\x08NSObject\x00\x85\x92\x84\x84\x84'
        b'\x08NSString\x01\x94\x84\x01\x2b' + length + raw +
        b'\x86\x84\x02iI\x01\x00\x84\x84\x84\x0cNSDictionary\x00\x94\x84\x01i\x01'
    )


LONG = (
    'This one is deliberately longer than one hundred and twenty seven bytes, '
    'because a length prefix read as a single byte truncates exactly here and '
    'not one character earlier, which is why short test messages never catch it.'
)
EMOJI = 'four bytes each, these: 🜁 🝊 🯅 — and a tail after them'

MESSAGES = [
    # rowid, handle, chats, from_me, date,                    text,        body
    (1, 1, [1], 0, ns(1546300800), 'hello', None),                     # 2019-01-01
    (2, 1, [1], 1, ns(1560556800), 'reply', None),                     # 2019-06-15
    (3, 1, [1], 0, secs(1367712000), 'the old encoding', None),        # 2013-05-05
    (4, 3, [2], 0, ns(1583193600), None, attributed('group hello')),   # 2020-03-03
    (5, 1, [2], 0, ns(1583280000), 'annie in the group', None),        # 2020-03-04
    (6, 4, [4], 0, ns(1600000000), 'from the uk', None),               # 2020-09-13
    (7, 2, [1], 0, ns(1625616000), 'same person, sms', None),          # 2021-07-07
    (8, 1, [1], 0, ns(1656633600), None, attributed(LONG)),            # 2022-07-01
    (9, 1, [1], 1, ns(1659312000), None, attributed(EMOJI)),           # 2022-08-01
    # In two chats at once. One row out, not two.
    (10, 1, [1, 2], 0, ns(1661990400), 'in two chats', None),          # 2022-09-01
    # Chat 5: the Apple-ID-only thread, and recent, so it exercises both the
    # chat_identifier path and every relative window at once.
    (11, 5, [5], 0, days_ago(2), 'two days ago', None),
    (12, 5, [5], 1, days_ago(10), 'ten days ago', None),
    # handle_id 0 — orphaned from any handle row. Only chat.chat_identifier can
    # find this one.
    (13, 0, [5], 0, days_ago(5), 'five days ago, no handle', None),
]

HANDLES = [
    (1, '+15550104477', 'iMessage'),
    (2, '5550104477', 'SMS'),
    (3, 'someone@icloud.com', 'iMessage'),
    (4, '+447700900123', 'iMessage'),
    (5, 'recent@example.com', 'iMessage'),
]

CHATS = [
    (1, '+15550104477', '', 45, 'iMessage'),
    (2, 'chat909090', 'THE GROUP', 43, 'iMessage'),
    (4, '+447700900123', '', 45, 'iMessage'),
    # An Apple ID thread, and deliberately NOT in CHAT_HANDLES below.
    (5, 'recent@example.com', '', 45, 'iMessage'),
]

# Note chat 5 is absent. Real databases have threads whose participant rows
# never got written, and a scope predicate that only reads this table loses
# every message in them.
CHAT_HANDLES = [(1, 1), (1, 2), (2, 1), (2, 3), (4, 4)]

ATTACHMENTS = [(1, 'IMG_0001.HEIC', 'image/heic'), (2, 'note.pdf', 'application/pdf')]
MESSAGE_ATTACHMENTS = [(5, 1), (5, 2)]


def make(path):
    db = sqlite3.connect(path)
    db.executescript(
        """
        CREATE TABLE message (
          ROWID INTEGER PRIMARY KEY, guid TEXT, date INTEGER, date_read INTEGER,
          is_from_me INTEGER, is_read INTEGER, handle_id INTEGER, service TEXT,
          text TEXT, attributedBody BLOB, cache_has_attachments INTEGER,
          associated_message_type INTEGER, associated_message_guid TEXT,
          thread_originator_guid TEXT);
        CREATE TABLE handle (ROWID INTEGER PRIMARY KEY, id TEXT, service TEXT);
        CREATE TABLE chat (
          ROWID INTEGER PRIMARY KEY, chat_identifier TEXT, display_name TEXT,
          style INTEGER, service_name TEXT);
        CREATE TABLE chat_message_join (chat_id INTEGER, message_id INTEGER);
        CREATE TABLE chat_handle_join (chat_id INTEGER, handle_id INTEGER);
        CREATE TABLE attachment (ROWID INTEGER PRIMARY KEY, transfer_name TEXT, mime_type TEXT);
        CREATE TABLE message_attachment_join (message_id INTEGER, attachment_id INTEGER);
        """
    )
    db.executemany('INSERT INTO handle VALUES (?,?,?)', HANDLES)
    db.executemany('INSERT INTO chat VALUES (?,?,?,?,?)', CHATS)
    db.executemany('INSERT INTO chat_handle_join VALUES (?,?)', CHAT_HANDLES)
    db.executemany('INSERT INTO attachment VALUES (?,?,?)', ATTACHMENTS)
    db.executemany('INSERT INTO message_attachment_join VALUES (?,?)', MESSAGE_ATTACHMENTS)

    for rid, handle, chats, from_me, date, text, body in MESSAGES:
        has_att = 1 if any(m == rid for m, _ in MESSAGE_ATTACHMENTS) else 0
        db.execute(
            'INSERT INTO message VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            (rid, 'guid-%d' % rid, date, 0, from_me, 1, handle, 'iMessage',
             text, body, has_att, 0, '', ''),
        )
        for chat in chats:
            db.execute('INSERT INTO chat_message_join VALUES (?,?)', (chat, rid))
    db.commit()
    return db


def decode_run(work, db, sql_path, py_path):
    """
    Run the emitted hex query and the emitted decoder over this database, the
    way the generated script does — same SQL, same python, same order.

    This is the check that matters most in the whole gate. The three blob rows
    in the fixture are a short ASCII message, one over 127 bytes, and one with
    four-byte emoji. A decoder that reads the length prefix as a single byte
    passes the first and fails the other two, and every casual test uses the
    first.
    """
    import csv as _csv
    import subprocess

    with open(sql_path, encoding='utf-8') as fh:
        sql = fh.read()
    cur = db.execute(sql)
    cols = [d[0] for d in cur.description]
    rows = cur.fetchall()

    raw = os.path.join(work, 'raw.csv')
    with open(raw, 'w', newline='', encoding='utf-8') as fh:
        writer = _csv.writer(fh)
        writer.writerow(cols)
        for row in rows:
            writer.writerow(['' if v is None else v for v in row])

    out_path = os.path.join(work, 'out.csv')
    proc = subprocess.run(
        [sys.executable, py_path, 'csv', raw, out_path],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        return {'error': proc.stderr.strip()[-800:]}

    with open(out_path, encoding='utf-8') as fh:
        got = {r['row_id']: r['text'] for r in _csv.DictReader(fh)}
    with open(out_path, encoding='utf-8') as fh:
        header = fh.readline()

    return {
        'stats': proc.stderr.strip(),
        'header_has_body_hex': 'body_hex' in header,
        'texts': {k: got.get(k, '') for k in ('4', '8', '9')},
        'want': {'4': 'group hello', '8': LONG, '9': EMOJI},
    }


def main():
    # `--write <path>` builds the fixture database somewhere durable, for the
    # end-to-end smoke test to point a generated command at.
    if sys.argv[1:2] == ['--write']:
        target = sys.argv[2]
        if os.path.exists(target):
            os.remove(target)
        make(target).close()
        print(target)
        return

    with tempfile.TemporaryDirectory() as work:
        db = make(os.path.join(work, 'chat.db'))
        if sys.argv[1:2] == ['--decode']:
            print(json.dumps(decode_run(work, db, sys.argv[2], sys.argv[3])))
            return
        out = []
        for path in sys.argv[1:]:
            with open(path, encoding='utf-8') as fh:
                sql = fh.read()
            try:
                rows = db.execute(sql).fetchall()
            except sqlite3.Error as err:
                out.append({'file': path, 'error': str(err)})
                continue
            cols = [d[0] for d in db.execute(sql).description]
            out.append({
                'file': path,
                'columns': cols,
                'rows': len(rows),
                'values': [list(r) for r in rows],
            })
        print(json.dumps(out))


if __name__ == '__main__':
    main()
