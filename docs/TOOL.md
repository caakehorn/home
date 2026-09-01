# THE TOOL — the working agreement

This room is built by several agents at once. This file is how they stay out of
each other's way. Read it before you touch anything under `src/tool/`.

If you are here to build a tool, the short version is:

1. Claim an id in **§1 The claims table** — one commit, on its own, pushed first.
2. Build inside `src/tool/tools/<id>/` and nowhere else.
3. Append one entry to `TOOLS` in `src/tool/core.ts` and one line to `BUILT` in
   `src/routes/Tool.tsx`. **Append. Never reorder.**
4. Add fixtures to `scripts/check-tool.mjs` and leave `npm run tool:check` green.

---

## 1. The claims table

Claim before you build. A claim is cheap; a collision costs somebody their
afternoon. Add your row, commit **that row alone**, and push before you write
any other code — that way the claim lands even if the rest of your session
does not.

| id | title | status | owner | notes |
|---|---|---|---|---|
| `imessage` | EXTRACT IMESSAGE | LIVE | first build | chat.db → CSV/TXT on the Desktop, with an address book |
| | | | | |

`status` is one of `SEALED` (claimed, unbuilt), `WIRING` (being built now),
`LIVE` (built, checked, reachable from the rack). It appears twice — here and
in `src/tool/core.ts` — and the two are expected to agree.

---

## 2. What this room promises

> **ONE PASTE. NO TINKERING AFTERWARDS.**

A tool asks its questions on the page and hands back one block of shell. Once
that block is in the reader's terminal, the job finishes on its own. A tool that
emits a command needing a hand-edited path, a follow-up command, or a "now open
this file and change line 3" **does not ship**.

Where a human genuinely is unavoidable, say so in the emitted script itself:
print what is needed, open the relevant settings pane if macOS has a URL for it,
and `exit 1`. Never let a script report success it did not have.

The corollary: everything that *can* be resolved on the website must be resolved
on the website. If your tool needs the reader's short username, their shell,
their macOS version — ask, or detect it inside the script. Do not leave a
`<YOUR_NAME_HERE>` in the output.

---

## 3. The contract

`src/tool/core.ts` is the contract file. A tool is **data plus two pure
functions** — it does not own the terminal, does not read the DOM, and does not
know it is on a web page.

```ts
export type ToolModule = {
  id: string
  steps: Step[]                              // asked in order by the shell
  compose: (answers: Answers) => Deliverable // pure, deterministic
  Panels?: ComponentType                     // optional surface beside the terminal
}
```

`Step` is one of `choice` | `text` | `dates` | `file`. `Deliverable` is
`{ script, notes, warnings }` — `notes` say what the command will do, `warnings`
say what it cannot do or does only approximately. **Never drop a warning to make
the output look tidier.** A tool that quietly ships truncated data is worse than
one that says it is truncating. The gate fails a fixture that emits no warnings
at all: every command in this room has something it cannot do.

### Branching without a graph

Every step takes an optional `when?: (answers) => boolean`. A step whose `when`
returns false is not asked, and `back` steps over it the same way — so a tool
lists every question it might ask and says which ones apply, rather than wiring
a graph of next-step pointers with unreachable states in it. It must be a pure
predicate over the answers: no DOM, no clock, same rule as `compose`.

`validate` on a text step receives the answers too, so a question can be checked
against an earlier one — EXTRACT IMESSAGE uses it to insist on an @ when the
reader said Apple ID and on digits when they said phone number.

### Panels

A tool may export `Panels`, mounted beside the terminal. It gets four verbs from
`useShell()` and no more: `answer`, `say`, `answers`, `waitingOn`. A panel can
answer the question on screen and print a line; it cannot move the step pointer,
rewrite history, or reach the input. The shell owns the conversation, and a
panel that could drive it would be a second source of truth for where the reader
is.

Anything a panel gathers has to end up **inside an answer string**, because
`compose` sees nothing else. EXTRACT IMESSAGE writes `Name <handle>` for a
contact picked from the address book for exactly this reason: it reads correctly
in the terminal echo, and it keeps the deliverable reproducible by the gate.

### `compose` must be deterministic

Same answers in, byte-identical script out, forever. No `Date.now()`, no
`Math.random()`, no iteration over a `Set`/`Map` whose insertion order the reader
controls. `npm run tool:check` composes every fixture twice and diffs the two —
an accidental clock reference fails the build, which fails the deploy.

If your script genuinely needs a timestamp, have the *script* compute it at run
time (`$(date +%Y%m%d-%H%M%S)`), not `compose`.

### Quoting is not optional

Everything the reader types can reach a shell and, in some tools, a SQL string.
Use the helpers in `src/tool/shell/quote.ts` — never string concatenation, never
a hand-rolled `replace(/'/g, "\\'")`. The check ships an adversarial fixture set
(names containing `'`, `"`, `` ` ``, `$(…)`, `;`, newlines, `--`) and your tool
is expected to survive it.

---

## 4. File ownership

| Path | Who may edit it |
|---|---|
| `src/tool/tools/<id>/**` | **only** the agent that claimed `<id>` |
| `src/tool/shell/**` | shared kernel — coordinate before changing |
| `src/tool/decor/**` | shared — per-tool ornament goes in your own `Panels` |
| `src/routes/Tool.tsx` | append one line to `BUILT`, change nothing else |
| `src/tool/core.ts` | append one entry to `TOOLS`, change nothing else |
| `docs/TOOL.md` §1 | append your row |
| `scripts/check-tool.mjs` | append your fixtures to the fixture array |

Anything in the shared column that genuinely needs a change: make the change
additive and backwards-compatible if you possibly can, and say so in your commit
message so the other agents see it in `git log`.

---

## 5. House rules that bite in this room

These are `CLAUDE.md`'s, restated where they actually apply here.

- **No new npm dependencies.** Four dependencies ship today. A CSV parser, a
  vCard parser, a shell quoter — write them, they are forty lines each.
- **`verbatimModuleSyntax` is on.** `import type { X }`, always.
- **`noUnusedLocals` / `noUnusedParameters` are on.** An unused import fails
  `tsc -b`, which fails the build, which fails the deploy.
- **Every asset URL goes through `import.meta.env.BASE_URL`.** The site deploys
  to `/home/`. Vite does not rewrite string literals.
- **Anything that animates reads `motion` from `usePortal()` and stops when it
  is false.** `src/components/Crawl.tsx` is the reference rAF loop.
- **`touch-action: none` owes the reader a replacement gesture** — see
  `CLAUDE.md` §5. The simplest way to comply is to claim no gesture at all,
  which is what this room does.
- **Decor is ornament and says so.** Nothing in here may render a number that
  looks measured and is not. If you draw a readout, label it.
- **Checkpoint your work.** A commit at every milestone where `npx tsc -b
  --noEmit` and `npm run build` are clean, even mid-feature.

---

## 6. The build gate

`npm run tool:check`, in `scripts/check-tool.mjs`. It asserts four things about
every registered fixture:

1. **Determinism** — composed twice, byte-identical.
2. **Golden files** — matches its committed `scripts/fixtures/tool/*.sh`, so a
   drift is a visible diff rather than a silent one.
3. **Injection safety** — the adversarial answer set produces no escaped
   metacharacter.
4. **It actually runs** — where a tool emits SQL, the check builds a synthetic
   database with the real schema and executes the generated query against it,
   asserting an exact row count. This is the check a typecheck cannot do: it is
   what catches a mistyped column name.

Adding a fixture is adding an object to the array at the top of the script.
Regenerating a golden file is deliberate: `npm run tool:check -- --bless`.
