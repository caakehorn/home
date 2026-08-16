---
title: A LOCK ON A BUILDING WITH WINDOWS
slug: a-lock-on-a-building-with-windows
date: 2026-07-22
dek: The gate on the front of this site is real cryptography doing a job that is mostly theatre, and pretending otherwise would be the actual security failure.
tags: gate, security, honesty
kana: 錠前
tone: 3
---

The door you came through is three steps. A terms dialog you have to tick. A
quiz where the empty answer is the right one. And a passphrase, which is the
only one of the three that is a lock.

The lock is not decorative. It is PBKDF2-SHA256 at 250,000 iterations feeding
AES-256-GCM, and it checks your passphrase by **decrypting a blob** rather than
by comparing a hash. Wrong phrase, GCM authentication fails, the promise throws,
you are not in. There is no stored hash anywhere in the repository, so there is
nothing to grind offline faster than 250k iterations a guess. Get it wrong and
the screen is taken for thirty seconds against a **deadline in `sessionStorage`,
not a timer** — reloading does not skip it, which quietly makes the lockout the
rate limiter too.

That is a real lock. Here is what it does not do.

## It gates rendering, not access

The router does not mount until the gate resolves, so there is no frame in which
the site exists on screen unlocked. Good. Irrelevant. These still resolve for
anybody who types the URL:

- `public/wiki/**` — the entire vendored wiki snapshot
- `public/leviathan/**` — every instrument dataset
- every asset in the build

And the repository is public, so all of it is readable on github.com no matter
what the deployed site does.

## Why I left it that way

Because the alternative is worse in a specific way. Real protection at rest
means three things, in this order: encrypt the payloads and have the pages
decrypt them with the gate's own passphrase; purge the history, because git
keeps every plaintext blob ever committed and a rewrite you do later is a
rewrite you do to a repository other people have already cloned; and make the
repository private, which takes the site down for the crawlers and the agents
that are the entire point of `llms.txt`.

Those are three real projects with a real cost. I have not done them. So the
honest description of what is on the front of this site is:

> a lock on the front door of a building with windows

which is worth having, and is not worth mistaking for something else.

## The failure mode I actually care about

Every "secure" hobby project I have taken apart failed the same way, and it was
never the crypto. It was that the author described the lock and never described
the windows, and then somebody — usually the author, eighteen months later —
put something behind it that needed a building without windows.

So the README says it out loud, and now this does too. The threat model is not
"an attacker". The threat model is **me, later, misremembering how much this
protects.**

## The one thing I would change today

If the build has no verifier — no `HOME_PASSPHRASE` secret configured — the gate
says so on the passphrase step and lets you through. A missing build secret
should not brick a site for everyone including its owner, and a door that
pretends to be locked when it is not is strictly worse than a door that admits
it is open.

That is the only design principle here that I would defend at four in the
morning: **say what the lock does.** Everything else is a parameter.
