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
| **From install to the first matched song, he types nothing** (T1.1) | Seen in Chrome: the first video was named without typing | 2026-11-09, Bob verbatim: For panel check, nothing was appearing before click on panel. Then: Actually I have done the test with Claude Code a few times on this check. The pass rate was a bit lower than 50% I guess from intuition? Do you think that is a pass for developing by convention? Verdict, Bob verbatim: then that is for sure a pass for T1.1. |
| **Five of his own videos show the right song** (T1.2) | Six videos: 1 named right, 4 right silences (the songs are not on MusicBrainz, or the video is a whole album), and 2 faults found and fixed (the next video kept the last song; DEN matched "Pinewood Garden"). No wrong song shown since. Fewer than five named | Missed (2026-11-09): 2 of 5 showed the right song, 0 wrong, 3 fair silences (all the 百万级装备听 title style); Fix failed on all three. Bob verbatim: I think the blinding light one passed. We need to fix the fix feature I think, so that is not a pass to me? / The point is people hate uncertainty very much so the fix one needs fix is quite obious. After reading your words and your recitation of PRD, I agree it is has not pass yet because of the low pass rate then. |
| **Fixing takes two taps** (T1.4) | Done: a pick held after a reload | Missed (2026-11-09): two taps and held, but the list let him keep the right recording in none of four tries (Heat Waves, Yellow, Sunflower, Blinding Lights). Bob verbatim: No pass then because it fails its purpose. Its uncertainty makes user feel it does not worth its friction/effort added from one more click |
| **Check A** (FR-CORE-4, five answers by Bob's ruling) on the questions way in | Bob took it once before the answers were fixed at five; not yet run again at `/judge` | 2026-11-09, Bob verbatim: All right I did a quick test myself. 5 lines popped out, 2 I find needs some working, 1 is too obvious from the answer, and 2 looks better but may benefit from more work from our improving process because we need it anyway for others. 2 lines need working: "Of the six songs whose key could be measured, five are in a major key." and "Four of your songs, by four different artists, move at nearly the same pace: 88 to 95 BPM." the two sides notes explaining key notes and BPM are helpful, but I really don't know what they are in sound, thus lose the ability to contemplate roles they play in a music. It is a hard process for even the music professionals I argue. 1 too obvious: "In four of the seven songs where you said what you come back for, you picked “the chorus”." It feels direct because it comes from directly from the option, and I feel like it is such a shallow read. It is a overall question as well. Again reference back to the orange juice example: You cannot stop at you like to drink OJ every morning, it seems you like sour and sweet taste of it in the morning(this in the morning part is often missing also, which is bad). We need a further layer that is it brings you the refreshing feeling which is valuable. If it is not obvious, just state it as a inference. The other two did better because it provides a point that people go back to music they heard in their twenties, and that is exactly the case for me. But I would like to know why that is the case, which is valuable but missing in the website. Also two design problems for the website: 1. for What do you come back for?  I think option should be different when I input a album, it is kind of obvious I don't come back to a album because of chorus of songs all the time but that was a option there. 2. for When did this song find you? I want it looks like a 进度条 that entails options 之间覆盖和集合的关系. like this month should be part of a year. Ask me questions about it if you are not sure *(Translation, not Bob's words: 进度条 = "progress bar"; 之间覆盖和集合的关系 = "the overlap and set relations between [the options]".)* Asked pass or miss, Bob verbatim (2026-11-09): I think we are on the right track, just need honing? The format is taking quite a lot friction because I am inputting manually songs one by one, as I have to recollect through the way which is difficult and frustrating because I am not sure if that is the best songs to put in. Maybe we can fix these two questions, but the read is definitely better than the project before Confirmed, Bob verbatim (2026-11-09): Yes, passed, with honing. I now can tell songs in my twenties are very important parts of my taste. Which happens to be the case. |
| **Swap test** against the friend's named songs (FR-CORE-4) | Put off until the friend has time (2026-11-09). Ready to run: Bob's private guide "Friend's Listening Test" (English and Chinese), an Incognito window, about 10 minutes for Bob and 20 for the friend; counts only come back | waiting for the friend |
| **Swap test on own-record lines** (FR-T2.2) | Not yet possible: needs plays of one song or artist on three or more separate days | |
| **Check D** (FR-T4.5): does he try the suggested record and keep it | Not yet: needs "Where next?" to suggest a record over a few listening sessions | Open: judged in one combined test with the friend after the rework (see verdict test D) |

## Bob's verdict test (PRD section 1)

| Test | Bob's verdict |
|---|---|
| **A.** I can say one thing about my taste I could not say before, and I agree with it when I check the choices behind it | Passed (2026-11-09). The thing: "I now can tell songs in my twenties are very important parts of my taste." (his words, given at check A). Bob verbatim: It is the first kind so a pass for A. But didn't we talked and recorded this one already? I said we need honing the current one is too shallow. I propose the solution is you go to many many top comments for music in apps like Spotify or NetEase music and find the Gems there. Or find some study about it. But the goal is to find the third layer like the OJ example, and complete the second layer of the OJ example. I don't know why we are circling back to this problem though |
| **B.** Generator prompt: not testable in this build (out of scope) | not testable in this build |
| **C.** I open it again with no reminder, because the listening is a pleasure | Open: needs real use (2026-11-09, Bob's choice; no first impression recorded as a verdict). Bob verbatim: I think even if I have first impression we should leave it blank for now. I feel like it is not lively enough now but I don't want to harm the fancy feeling of it, and I don't know how to make extension to look better. I may open it but currently the options there does not fit the tab size I guess because there is a lot of blanks, but did you left those blanks for designer reasons? I don't know because I am not a professional. I will ask you to use the right designer persona for this. But I do think it takes time to build a hobby so the problem might not be that |
| **D.** I find a new album or artist I keep, with less effort than listening through whole albums or reading Pitchfork | Open: to be judged in one combined test with the friend, after the rework is built (2026-11-09, Bob's choice). Bob verbatim: I would like to either try it or let my friend try it. Also I found a real problem, in rare case like mine I would drop my friend's Spotify file, should we state that as a option aside of the original one? Or did I understand it wrong that you actually want me to play as my friend's role or ask him to try on it? It is fine to ask him to try it tomorrow, as long as you make it a chunk of one big test of everything. But I think we can finish the build first |
| **The goal:** fun or useful enough that I would choose to use it | 2026-11-09, Bob verbatim (his words, no pass or miss label given): Yep. This is for sure the best thing we have created in 6 month now, and I can see it getting better. Pet your self on the back and encourage me some on what we did right and maybe be mindful of what we did wrong. And we are ready for next stage? |

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
