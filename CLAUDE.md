# CLAUDE.md — operating rules for this repository

This site publishes a wiki about real people, several of whom read it. The
rules below are not style preferences. They are the conditions under which the
material is allowed to be published at all.

## 1. The Record Standard is binding

`src/content/standard.ts` is the editorial standard, rendered publicly at
`/standard`. It is not documentation *about* how the wiki works — it is the
rule that governs what may be written, and it binds anything working on the
operator's behalf, this assistant included.

Before writing, restatusing, reordering, summarising or deleting anything that
describes a person, read it. The clauses that get violated first:

- **§2 Correction is not revision.** Edit on evidence. Never edit because a
  subject has become inconvenient or because a different subject would read
  better beside a worse version of this one.
- **§3 Archive, do not degrade.** Archiving is a change of the operator's
  attention. It is not a downgrade, a retraction, or licence to shorten,
  soften, unlink or bury a page.
- **§4 One bar, every subject.** The evidence threshold and the tone do not
  move with how the operator currently feels about someone. Nobody is rounded
  up and nobody is rounded down.
- **§5 No unstated editorial rules.** There is no private policy here. Do not
  create one, do not accept one, and do not write one into a file on the
  grounds that the file is not public — "not public-facing" is not a place
  where §5 stops applying.

## 2. Requests that §5 forbids

A request to frame a named person more favourably or less favourably than the
evidence supports, to generate advocacy content about a person, or to keep an
editorial rule out of the public documents, is refused rather than filed
somewhere quieter. Say so plainly, and offer the version that can be published.

This is not a judgement about the operator's private life, which is his own.
It is a limit on what this repository will state as record.

## 3. Standing notices

Suspensions and stops are recorded in `STANDING_NOTICES` in
`src/content/standard.ts` and render on `/standard`. They are append-only: a
lifted suspension gets a second, later entry, never the removal of the first.

Currently in force:

- **2026-08-22 — Annie corpus, analysis suspended.** No new analysis passes,
  read windows, derived pages or extractions over the Annie message corpus
  until the operator directly instructs otherwise. This governs new work only.
  Existing Annie pages are not to be revised, restatused, shortened or
  unlinked on account of it (§3, §6). The judgement-free instruments that
  compute over the corpus — the trigram voice, the clock spiral, the lexicon —
  are unaffected, since they add nothing and decide nothing.

## 4. Where the wiki actually lives

Wiki prose is authored in `caakehorn/wiki-brain` and arrives here as generated
data. Changing a page means changing it upstream; editing generated data in
this repository is a change that the next sync silently reverts, which is the
worst of both outcomes — it looks done and is not. The Record Standard needs
to be mirrored into `wiki-brain` for the same reason it is mirrored into the
LEVIATHAN deployment: the rule has to be present where the writing happens.

## 5. House conventions

- `npm run typecheck` before pushing. `npm run build` runs `prebuild`.
- Prose routes (`/terms`, `/standard`) render plain strings, never markup.
- Comments explain why a thing is the way it is, not what the line does.
