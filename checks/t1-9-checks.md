# T1.9 checks: a record with the panel closed (2026-11-14)

Bob's five checks for T1.9 (FR-T1.9, Amendment of 2026-11-14), fixed before the build. Bob runs them; the
build does not. This sheet holds no private material: no plays, no titles, no exports. Write only "Passed",
"Failed" and what you saw, never a song or video title.

**Before you start.** Open `chrome://extensions`, press the reload arrow on "The Key", then reload every
Bilibili tab that is already open (a tab opened before the reload keeps the old script, and nothing hears it).
The panel is closed when its side area is not showing; the toolbar icon opens it.

**How to read check 1, 4 and 5 (Bob's ruling, 2026-11-14).** The panel shows only one sentence with the count.
The list of plays is read from the export: in the panel, "My numbers and export", then "Export my record".
In the file, `D1_plays` holds one entry per play. Each has `page_title` (the video's title),
`heard_seconds` (seconds heard), `started_at` (when it began) and `recorded_with` ("panel closed" or
"panel open").

**T1.9 fails if** any play made with the panel closed is missing, if any play is stored while recording is
paused, or if anything of The Key's appears on a page or on the toolbar while the panel is closed.

| # | What to do | What passes | Verdict |
|---|---|---|---|
| 1 | With the panel closed, play three videos for at least 30 seconds each, one of them twice (play it to its end and play it again, or open it again). Count the seconds yourself. Open the panel, then export. | The panel says "The Key recorded four plays while this panel was closed." The export lists four plays with `recorded_with` "panel closed", each with its title, and each `heard_seconds` within five seconds of your own count. | Failed, on the panel's sentence only. It counts closed plays still waiting to be named, not plays recorded while the panel was closed; it said five where seven closed plays were recorded. Every play was kept with its title, seconds were within five of the video's length on every play that reached its end, and nothing showed while the panel was closed. |
| 2 | In the panel's settings at the bottom, switch on "Pause recording". Play one video. Switch it off. Play another. Export. | Only the second video is in the export. While paused, the settings say "Recording is paused. Nothing you play is kept until you switch this off." | Passed. Nothing played while paused was kept; the paused sentence was word for word. One false 0-second row appeared after resuming, from changing videos inside one page; sent to Claude Code as a defect. |
| 3 | Close the browser completely and open it again. Play one video without clicking anything of The Key's. Then open the panel and export. | That play is in the export, with `recorded_with` "panel closed". | Passed. Plays after a full restart were kept as "panel closed" with no click. A tab Chrome restored made two short rows, one with the wrong length (the defect from check 2). |
| 4 | Export your record. Then press "Erase everything in this browser" and confirm. Export again. | The first file carries `recorded_with` on every play made since this build. The second file's `D1_plays` is empty. | Passed. Every play since this build carried recorded_with in the first file; the second file held no plays. |
| 5 | Listen as you normally do, without opening the panel, for as long as you choose. Then open it once and export. | The export holds plays you recognise as your real listening, and you cannot name a song you played that is missing. | |

**While you test, also watch for** anything of The Key's on a Bilibili page or on the toolbar icon while the panel
is closed (a badge, a mark, a notice). There should be nothing.

**Known limits after the build** (so a result is not misread):
- Plays made before this build carry no `recorded_with`; all of them were made with the panel open.
- A video played in a tab behind another while the panel is open in the same window is not kept (as before T1.9).
- Seconds heard on a play already on the record before you paused keep counting from the video's own clock, and
  the seconds played during the pause are added when you switch recording back on.
- Songs for closed plays are named when the panel opens, one at a time. MusicBrainz refused about one call in
  three on 2026-11-14; a refused one is tried again at the next opening.

## Re-check after the T1.9 defect fix (2026-11-15)

Two faults were fixed after Bob's checks of 2026-11-15. (A) The panel's sentence counted closed plays still
waiting for a song name. Now it counts each play kept with the panel closed exactly once, at the first opening
after it was kept. (B) When the video changed inside one Bilibili page, a row could take the next video's
length, or a row could be made with 0 seconds heard. Now each row is one video's own. Bob runs these two rows;
the build does not. Write only "Passed", "Failed" and what you saw, never a song or video title.

**Before you start.**
1. Open `chrome://extensions`. "The Key" is loaded unpacked from
   `C:\Users\siqiw\Desktop\standard-of-taste-key\extension\dist`, which is already rebuilt. Press its reload arrow.
2. Reload every Bilibili tab already open: a tab opened before the reload keeps the old script.
3. **Open the panel once and close it.** That first opening counts the plays kept before the fix, so row A
   starts from zero.

**New in the export.** A play kept with the panel closed now carries `counted_at_opening`: the time of the panel
opening whose sentence counted it. Two plays with the same time were counted by the same opening.

| # | What to do | What passes | Verdict |
|---|---|---|---|
| A | With the panel closed, play two videos for at least 30 seconds each. Open the panel and read its sentence. Close it, play one more video, and open it again. | The first opening says "The Key recorded two plays while this panel was closed." The second says "The Key recorded one play while this panel was closed." | |
| B | In one Bilibili page, click from one video to another in its list, then back to the first, playing each for at least 30 seconds. Then export. | Each row's `duration_seconds` is its own video's length (the length Bilibili shows for that video), and no row has `heard_seconds` 0. | |

**Check 5 begins after this.** Bob's organic listening (check 5 above) starts once this fix is reloaded, so that the
record it reads is made by the fixed recorder. Recommended before it begins: keep row B's export, then press
"Erase everything in this browser" and confirm. The record then holds neither these test plays nor the plays the
old recorder made after the erase of check 4.

**Known limits after the fix** (so a result is not misread):
- When the video changes, the panel names the new one once the page has settled: at once when the player and
  the page have both moved on, otherwise after the page has held still for three seconds. A page just opened
  or restored always waits three seconds. No seconds are lost to the wait; they are added to the new play.
- A video heard for less than that wait before its tab is closed is not kept.
- A song you fix on a video you never play is not kept, because no row is kept before one second is heard.
- If Bilibili's player ever reports a different length for the same video in the middle of a play, that listen is
  kept as two rows of the same video. This was chosen over the other error (a row taking seconds of the next video);
  if row B shows two rows for one listen, say so.
