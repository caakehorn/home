/**
 * Quoting, for text that is going to end up inside a command somebody runs.
 *
 * Every tool in this room takes something the reader typed — a name, a path, a
 * phone number pasted out of a contact card — and puts it inside a block of
 * shell. That is the whole shape of the room, and it is also the whole shape of
 * a command injection, so none of it is done by hand. There is no
 * `.replace(/'/g, "\\'")` anywhere in `src/tool/`; there is this file.
 *
 * ---- the three layers ------------------------------------------------------
 *
 * A deliverable is nested, and each layer has its own rules:
 *
 *   1. The outer heredoc, opened with a QUOTED delimiter (`<<'MARK'`). A quoted
 *      delimiter means the shell performs no expansion at all on the body — no
 *      $, no backtick, no \. Everything inside arrives at the script verbatim.
 *      The single thing that can break out is a line that IS the delimiter, so
 *      `heredoc()` picks a marker and refuses to emit if the body contains it.
 *
 *   2. The script itself, which is shell and will be executed. Anything the
 *      reader supplied that lands here goes through `sh()` — POSIX single-quote
 *      wrapping, which has exactly one escape and no exceptions.
 *
 *   3. SQL, which is passed to sqlite3 through its own quoted heredoc, so layer
 *      2 does not apply to it and only SQL quoting is needed: `sq()`.
 *
 * Getting the layering wrong in the safe direction produces an ugly command;
 * getting it wrong in the other direction produces a command that runs whatever
 * was in a contact's name field. `npm run tool:check` composes an adversarial
 * answer set through every registered fixture for that reason.
 */

/**
 * POSIX single-quote a string for the shell.
 *
 * Inside single quotes every byte is literal — there is no escape character at
 * all — so the only thing that needs handling is the closing quote itself, and
 * the standard trick is to end the quoted run, emit an escaped quote, and start
 * a new one. `it's` becomes `'it'\''s'`. This is safe for every byte including
 * newlines, backticks, `$(…)`, `;` and `--`; there is no input for which it is
 * not, which is the reason to use it rather than a blocklist.
 */
export function sh(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/**
 * Quote a string as a SQL literal: double the single quotes, wrap in single
 * quotes. SQLite has no backslash escape in string literals, so this is the
 * whole of it.
 *
 * A NUL byte would truncate the statement at the C string boundary inside
 * sqlite3 rather than error, which is a silent wrong answer — the worst kind.
 * It cannot appear in a value typed into an <input>, but it can appear in one
 * parsed out of an uploaded file, so it is dropped here rather than trusted not
 * to arrive.
 */
export function sq(value: string): string {
  return `'${value.replace(/\0/g, '').replace(/'/g, "''")}'`
}

/**
 * A SQL identifier — a table or column name — quoted in double quotes.
 *
 * No tool should be building identifiers out of reader input, and none does.
 * This exists so that the generated SQL can quote the handful of chat.db column
 * names that are also SQL keywords without anybody reaching for concatenation.
 */
export function sqlId(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`refusing to quote an identifier that is not one: ${name}`)
  }
  return `"${name}"`
}

/**
 * Wrap a body in a heredoc with a quoted delimiter, so the shell expands
 * nothing inside it.
 *
 * The delimiter is checked against the body rather than assumed unique. A body
 * containing its own delimiter on a line by itself would end the heredoc early
 * and hand the rest of the payload to the shell as commands — which is the one
 * way this construction fails, so it is the one thing checked. Throwing is
 * correct here: a tool that cannot emit a safe script must emit none.
 */
export function heredoc(marker: string, body: string): string {
  if (!/^[A-Z][A-Z0-9_]*$/.test(marker)) {
    throw new Error(`heredoc marker must be SHOUTING_SNAKE: ${marker}`)
  }
  const clash = body.split('\n').some((line) => line.trimEnd() === marker)
  if (clash) {
    throw new Error(`heredoc body contains its own delimiter line (${marker})`)
  }
  return `<<'${marker}'\n${body}\n${marker}`
}

/**
 * A filename-safe slug, for the part of an output filename that comes from
 * something the reader typed.
 *
 * Aggressive on purpose. This value ends up in a path, and a path is the other
 * place a clever string does damage: `..`, a leading `-` that a later command
 * reads as a flag, a `/` that moves the write somewhere else. Everything
 * outside `[a-z0-9-]` becomes a hyphen, runs collapse, the ends are trimmed,
 * and an empty result falls back rather than producing a file called `.csv`.
 */
export function slug(value: string, fallback = 'export'): string {
  const out = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '')
  return out || fallback
}
