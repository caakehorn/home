#!/usr/bin/env python3
"""
Enough of the sqlite3 CLI to run an emitted command on a machine without one.

    scripts/tool-sqlite3-shim.py [-csv] [-header] <db> [sql]

Used only by `npm run tool:check --smoke`, which runs a real generated script
end to end against a fixture database. The container this repo is built in has
no sqlite3 binary; it does have python3, whose sqlite3 module is the same
engine. This is the thinnest possible adapter between the two — it supports the
three flags the emitted scripts actually use and nothing else, deliberately,
because a fuller emulation would be a second implementation to keep honest.

SQL comes from argv when given and from stdin otherwise, which is the split the
emitted scripts rely on: a bare `SELECT 1;` as an argument for the access
probe, and a heredoc for everything long.
"""

import csv
import sqlite3
import sys


def main():
    args = sys.argv[1:]
    want_csv = '-csv' in args
    want_header = '-header' in args
    rest = [a for a in args if not a.startswith('-')]
    if not rest:
        sys.stderr.write('shim: no database given\n')
        return 1

    db, sql = rest[0], (rest[1] if len(rest) > 1 else sys.stdin.read())
    try:
        conn = sqlite3.connect(db)
        cur = conn.execute(sql)
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description] if cur.description else []
    except sqlite3.Error as err:
        sys.stderr.write(f'Error: {err}\n')
        return 1

    if want_csv:
        writer = csv.writer(sys.stdout, lineterminator='\n')
        if want_header and cols:
            writer.writerow(cols)
        for row in rows:
            writer.writerow(['' if v is None else v for v in row])
    else:
        for row in rows:
            print('|'.join('' if v is None else str(v) for v in row))
    return 0


if __name__ == '__main__':
    sys.exit(main())
