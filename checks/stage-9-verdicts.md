# Stage 9: Bob's verdict sheet

The build of The Key (Now scope) is done. Every line below is a verdict only Bob can give. Write yours in the last column, or say it in chat and Claude records it. Never shipped.

## What to open

| What | Where |
|---|---|
| The website | https://standard-of-taste-key.vercel.app: `/songs` (name songs), `/judge` (check A), `/look-back` (a Spotify file), `/my-numbers` (your numbers and export), `/note` |
| The extension | Chrome, `chrome://extensions`, The Key (reload it after each update), then any Bilibili video and the side panel |
| The launch-gate sheet | `npm run gate`, then http://localhost:3214 (on this computer only) |

## The four numbers (end of build, 2026-11-09)

| Number | Result |
|---|---|
| Spec gap rate (steps whose result needed rework) | 3 of 8: Step 3 (check A's answers), Step 5 (the matching rule, and the panel moving between videos), Step 6 (the gate sheet reading a paste) |
| Cause split (per rework) | missing from the spec: 4 · AI misread: 2 · changed mind: 0 |
| Traceability (shipped features with a task ID linked to an insight) | 26 of 26: 100% |
| Insight coverage (insights with at least one Now story) | 7 of 7 |

## Checks the PRD gives Bob

| Check | Status | Bob's verdict |
|---|---|---|
| **Launch gate** (T8.3): 0 wrong songs in 50 titles from a new uploader | Passed on run 5 (鼠鼠的音乐频道): 17 matches, all right, marked from MusicBrainz's records at Bob's request; counts for rule v6.3 by Bob's ruling. See `checks/gate-run-5.md` | Counted (2026-11-09) |
| **From install to the first matched song, he types nothing** (T1.1) | Seen in Chrome: the first video was named without typing | |
| **Five of his own videos show the right song** (T1.2) | Six videos: 1 named right, 4 right silences (the songs are not on MusicBrainz, or the video is a whole album), and 2 faults found and fixed (the next video kept the last song; DEN matched "Pinewood Garden"). No wrong song shown since. Fewer than five named | |
| **Fixing takes two taps** (T1.4) | Done: a pick held after a reload | |
| **Check A** (FR-CORE-4, five answers by Bob's ruling) on the questions way in | Bob took it once before the answers were fixed at five; not yet run again at `/judge` | |
| **Swap test** against the friend's named songs (FR-CORE-4) | Not run: the friend names five to ten songs on the website first (about ten minutes) | |
| **Swap test on own-record lines** (FR-T2.2) | Not yet possible: needs plays of one song or artist on three or more separate days | |
| **Check D** (FR-T4.5): does he try the suggested record and keep it | Not yet: needs "Where next?" to suggest a record over a few listening sessions | |

## Bob's verdict test (PRD section 1)

| Test | Bob's verdict |
|---|---|
| **A.** I can say one thing about my taste I could not say before, and I agree with it when I check the choices behind it | |
| **B.** Generator prompt: not testable in this build (out of scope) | — |
| **C.** I open it again with no reminder, because the listening is a pleasure | |
| **D.** I find a new album or artist I keep, with less effort than listening through whole albums or reading Pitchfork | |
| **The goal:** fun or useful enough that I would choose to use it | |

## Each step's result

| Step | What it built | Result | Bob's verdict |
|---|---|---|---|
| 1 | The clean room, the workspace, Card stock | Built as specified | |
| 2 | The three ways in as screens, on labelled example data | Built | |
| 3 | Songs that come to mind, for real; the checks on every sentence; check A | Reworked: check A's answers made five and mutually exclusive, by Bob's ruling | |
| 4 | The look back from a Spotify file | Built; tried on the friend's file by Bob's grant, counts only, nothing kept | |
| 5 | The panel: matching, the play record, Fix | Reworked: rule v6.1, v6.2, v6.3; moving between videos fixed | |
| 6 | The launch-gate sheet | Reworked: the paste reading (dates, tabs, glued dates, first 50 of a longer paste) | |
| 7 | The panel's words: first words, proof, stories, how it was made | Built; English copy reviewed by Cowork; the Sancho retelling in Bob's voice | Accepted ("continue step 8") |
| 8 | Where next, usage log, my numbers, export, deploy | Built and deployed | |

## Not built

- **The shared-person reason in "Where next?"**: it needs each suggested record's credits, and it may never stand alone.
- **/about-the-build** (PRD 6.3): Bob's own story, which needs his words.
