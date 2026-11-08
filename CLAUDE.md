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

**How work runs here.**
- Every build step names its task IDs (T1.1 … T9.5, FR-CORE-1 … 4).
- One test file per task ID, named after it (`t9-3.test.ts`); `npm test` runs before every commit.
- No guard or test from the old live site is copied. Only the five assets the PRD names are reused, each tied to a task.
- Never write into the live site's folder (`C:\Users\siqiw\Desktop\Prototype1`) except its private build log and trace matrix.
- Private material never enters this repository: no friend's export, no research notes, no screenshot of a real person's data. Fixtures are synthetic or Bob's own song titles; fictional names on any example screen are labelled as examples.
- Every commit records: `North-star:`, three `Red-team:` lines, `Confession:`.

**Layout.** `core/` (matching, checks, sources, templates, pattern and look-back computation, the Card stock design and the shared screens) · `extension/` (Manifest V3 side panel) · `web/` (Next.js static export) · `checks/` (the launch-gate sheet; never shipped).
