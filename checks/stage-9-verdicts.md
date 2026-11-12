# The combined Stage 9 test: Bob's verdict sheet

The rework after Stage 9 is built (Steps R1 to R8, 2026-11-11 to 2026-11-12). This is the sheet for the one combined test of everything, with Bob's friend taking part. The test runs in a chat in the Claude app linked to Bob's computer, never in Claude Code. Each verdict is Bob's alone. Write it in the last column, or say it in the chat and it is recorded there in his words. The friend's part is recorded as counts only, unless he agrees to be quoted. Never shipped.

The first Stage 9 verdicts (2026-11-09) are in this file's history (commit 2b5c03e) and in the private verdict record. They are not repeated here.

## What to open

| What | Where |
|---|---|
| The website | https://standard-of-taste-key.vercel.app: `/songs` (name songs and albums, the two questions, when it found you, your words about each record, the lines), `/reading` (a reading of your words), `/judge` (check A, the swap tests, the reading sheet), `/look-back` (a Spotify file), `/my-numbers` (your numbers and export), `/note` |
| The extension | Chrome or Edge, `chrome://extensions`, The Key, "Reload" (it was rebuilt on 2026-11-12), then any Bilibili video and the side panel |
| The coverage sheet (T1.2's bar) | `checks/coverage-hidden-half.md`: run 3, frozen as rule v7.2 |
| The reading's gate (T9.10) | `core/src/reading/gate.json` and `checks/reading-gate/` (the prompts and every output, both rounds) |
| The launch-gate sheet | `npm run gate`, then http://localhost:3214 (on this computer only) |

## The four numbers (end of the rework, 2026-11-12)

| Number | Result |
|---|---|
| Spec gap rate (steps whose result needed rework) | 4 of 19: Steps 3, 5 and 6 of the first build, and R2 (the coverage bar was not met on runs 1 and 2) |
| Cause split (per rework) | missing from the spec: 5 · AI misread: 2 · changed mind: 0 |
| Traceability (shipped features with a task ID linked to an insight) | 32 of 32: 100% |
| Insight coverage (insights with at least one Now story) | 8 of 8 |

## Before it starts

| Check | Status after the build | Bob's verdict |
|---|---|---|
| The friend's consent, asked of him directly, before anything of his leaves his browser | To be asked in the test | |
| A model key for this test alone | "Test the connection" printed "Connected to Claude Sonnet 5.5." in Bob's browser (2026-11-12, on this computer's copy of the site) | |
| The gate's result for the reading (FR-T9.10) | Passed on its second round (2026-11-12): 21 planted outputs refused; fresh runs: quotes word for word 22 of 22, "none" for the person with no story 3 of 3, rules broken 0. Round 1 failed (one 47-word question). One round-2 output was refused by code and counted as a false refusal, not a broken rule; Bob may overrule that | |

## Part 1. The panel (Bob)

| Check | Status after the build | Bob's verdict |
|---|---|---|
| T1.1: he types nothing before the first song is named | Passed on 2026-11-09; the panel's start is unchanged | |
| T1.2, the bar: at least 8 in 10 nameable videos named, 0 wrong | Met: run 3, 36 of 39 named, 0 wrong (rule v7.2) | |
| T1.2, his own five videos | Ready: rule v7.2 reads titles with 《》, credits and versions | |
| T1.4: Fix on Heat Waves, Yellow, Sunflower, Blinding Lights and two of his choosing | Ready: the studio original first, labelled; every row says what it is; a typed search | |
| T2.5: the bar and the line after a minute | Ready | |
| T1.7: the idle panel between songs, on several days | Ready; this begins verdict test C | |

## Part 2. The website (Bob)

| Check | Status after the build | Bob's verdict |
|---|---|---|
| T9.1, T9.2: an album named as an album; several at once; the album's options | Ready | |
| T9.8: when four records found him, one nested bar | Ready | |
| T9.7: hear a tempo and a key | Ready: made by the browser, labelled | |
| Check A at `/judge`, five answers, on the new lines | Ready | |

## Part 3. The reading (Bob, then the friend if he consented)

| Check | Status after the build | Bob's verdict |
|---|---|---|
| Six or more guesses judged with check A's five answers; new or his own sentence returned; the finding opened for half | Ready at `/reading` (his words about at least two records first, on `/songs`) | |
| Fail line 1: fewer than 1 in 3 guesses get "True, new to me, and it matters to me" | To be counted | |
| Fail line 2: a reading says something about him he did not write | To be judged | |
| Fail line 3: the swap test with decoys at `/judge`, "The reading sheet" | Ready: the friend uses "Export my questions" on his own reading page; the sheet mixes, hides and counts | |

## Part 4. The friend's record

| Check | Status after the build | Bob's verdict |
|---|---|---|
| Swap test on lines (FR-CORE-4), against the friend's named songs | Ready | |
| The look back (T5.7), his own Spotify file in his own browser | Ready; counts only come back | |
| Check D: "Where next?" names a record for each of them | Ready | |
| Two questions from the Stage 1b guide, before he sees any reading | To be asked | |
| What he does unasked | To be watched and listed | |
| Spotify's own taste reading (gap G-5) | If he has it | |

## Part 5. Bob's verdict test

| Test | Bob's verdict |
|---|---|
| **A.** One thing about my taste I could not say before, and I agree with it when I check | |
| **B.** Not testable in this build | not testable in this build |
| **C.** I open it again with no reminder | |
| **D.** A new album or artist I keep, with less effort than my usual way | |
| **The goal:** fun or useful enough that I would choose to use it | |

## Known differences and limits after the build

- The reading sets no temperature: this API version refuses one. It is checked by code instead.
- The panel links to the reading on the website; it cannot show a stored reading, because it cannot read what the website keeps.
- The panel and the website each keep their own records. Words and records written on the website are what the reading uses.
- The guesses in the gate's fresh runs mostly asked whether two records arrived in the same season.
- Known silences in matching: a cover band's own recording when the title says 翻唱; a "(from …)" note in a title.
