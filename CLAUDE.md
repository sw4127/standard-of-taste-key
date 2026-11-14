# CLAUDE.md: Standard of Taste, "The Key"

**The specification** is the Stage 7 PRD, kept privately on Bob's computer (it is never copied here). Build only what it lists. Where it is silent, choose the smallest thing that passes the acceptance test and record the choice in the build log. Where it contradicts itself, stop and ask Bob.

**Rules that bind every line of code** (PRD section 2, Bob's rulings):
1. Code decides every fact and number. No language model writes, chooses or judges any text or number the product shows, at build time or at use time (the one exception: the stored, checked stories, shown behind a tap and labelled).
2. No screen states a person's personality, mood or feeling as fact. A line names a pattern with its evidence and offers readings as questions, plus "Neither".
3. Nothing about trauma, abuse or mental health. Every shown sentence passes the register and carve-out checks; a sentence that fails is not shown.
4. A line about a person is built from that person's own record or answers, or it is not shown.
5. Nothing ever asks anyone to rank anything.
6. Nothing about a listener leaves the browser, except recording names or IDs sent to MusicBrainz and AcousticBrainz, a Bilibili page the user taps open, and the export file the user makes. No analytics, no server, no accounts.
7. No copyrighted audio played or stored; no music database bought or scraped; no script reads Bilibili's data. The extension reads only the page the user is viewing.
8. Simulated or fictional things are labelled where shown; no real artist or brand on a demo screen.
9. No points, XP, streaks, badges or leaderboards.
10. No paid tier, no payments, no paid API, $0 recurring cost.
11. Every specialist term appears with its plain meaning beside it.
12. Never ask "why do you like it".
13. The product never pitches how it was built during use.

**Amended 2026-11-10 and 2026-11-11 (the rework after Stage 9; PRD "Amendments of 2026-11-10", A1, and "Amendment of 2026-11-11"). Appended on 2026-11-11. The lines above are kept as history; where a line below differs from one above, the line below governs.**
- **Rule 1 (replaces rule 1 above).** Code decides every fact and every number. A model never scores, ranks or labels a person, and writes no sentence the product shows, with two exceptions: the stored, checked stories (as before), and **the reading** (FR-T9.9), where a model may quote the person's own words, choose which quotes to place together and which library finding sits nearest, and phrase the result as a question the person accepts, corrects or rejects. Code checks every quote word for word; a reading that fails a check is not shown. A reading, once made, is stored and shown unchanged, and is made again only when the person asks.
- **Rule 3, one addition.** After opting in, a person may write about loss or a painful time, and the reading may quote those words. Every guess is about what a record did, never about how two events in the person's life relate; the model says a record did only what the person's own sentence names the record as doing; it adds no cause, no comfort and no advice. Everything else in rule 3 stands.
- **Rule 6 (replaces rule 6 above).** Nothing about a listener leaves the browser, except: recording and album names or IDs sent to MusicBrainz and AcousticBrainz; a Bilibili page the user taps open; the export file the user makes; and, **only when the person taps to make a reading or to check their wording**, their written answers, the names of their records and the facts code computed about those records, sent to the model provider of the account they connected (Anthropic, with the person's own API key, by the amendment of 2026-11-11). The screen says what is sent and to whom before each send. No analytics, no server of ours, no accounts of ours, no key of ours.
- **Rule 10 (replaces rule 10 above).** Everything the product does with code alone is free. No payments are taken, no payment details are held, and nothing here costs Bob money to run. The one feature that costs money each time it runs (the reading) is paid by the person, to their own model provider, through their own account; the person sees the cost before each use and can decline. No payment hook is built.
- **The copy rule (design rule 10).** Every sentence the product shows is a whole plain sentence: no clipped fragments, no figure of speech where a fact will do, and a term from music theory only together with what the person can see or hear of it on the screen.
- **A real API key never enters a test, a fixture, a file, a commit or a chat.** Tests call a stand-in.
- Task IDs now run to T9.10; the rework's steps are R1 to R8.

**How work runs here.**
- Every build step names its task IDs (T1.1 … T9.5, FR-CORE-1 … 4).
- One test file per task ID, named after it (`t9-3.test.ts`); `npm test` runs before every commit.
- No guard or test from the old live site is copied. Only the five assets the PRD names are reused, each tied to a task.
- Never write into the live site's folder (`C:\Users\siqiw\Desktop\Prototype1`) except its private build log and trace matrix.
- Private material never enters this repository: no friend's export, no research notes, no screenshot of a real person's data. Fixtures are synthetic or Bob's own song titles; fictional names on any example screen are labelled as examples.
- Every commit records: `North-star:`, three `Red-team:` lines, `Confession:`.

**Layout.** `core/` (matching, checks, sources, templates, pattern and look-back computation, the Card stock design and the shared screens) · `extension/` (Manifest V3 side panel) · `web/` (Next.js static export) · `checks/` (the launch-gate sheet; never shipped).

Appended 2026-11-14

**How a step ends and how a build ends. This governs every build in this repository, whatever a prompt says or leaves out.**
- Before each step: tell Bob the plan for the step and one different approach, and which you recommend.
- Every step's reply ends with four things, and the same four go in the commit message: (1) proof from a real run: the test output, or what was seen in the browser; (2) three findings from red-teaming the step as a hostile reviewer, each with what was fixed in that step; (3) a confession: everything stubbed, mocked, hard-coded, skipped or not verified; (4) the north star, and how the step serves it. Put all of it in the reply and in the commit message.
- After each step: a row in the private build log (story · what was specified · what was built · why it differed), the trace matrix updated, and the four numbers (spec gap rate, cause split, traceability, insight coverage). If traceability falls below 100%, stop and fix it before the next step.
- Bob sees something working after the first step of a build, not only after the last.
- Every build ends, before the last reply and without being asked, with: a hostile red-team of the whole build, saying what was fixed and what was left; a dated handoff in C:\Users\siqiw\Desktop\Prototype1\docs\rebuild-2026-10\ named handoff-YYYY-MM-DD.md; and the next activation prompt, saved in that folder and given to Bob in the chat in one copy block whose first line says where it runs.
