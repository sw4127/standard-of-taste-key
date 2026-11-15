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
| 1 | With the panel closed, play three videos for at least 30 seconds each, one of them twice (play it to its end and play it again, or open it again). Count the seconds yourself. Open the panel, then export. | The panel says "The Key recorded four plays while this panel was closed." The export lists four plays with `recorded_with` "panel closed", each with its title, and each `heard_seconds` within five seconds of your own count. | |
| 2 | In the panel's settings at the bottom, switch on "Pause recording". Play one video. Switch it off. Play another. Export. | Only the second video is in the export. While paused, the settings say "Recording is paused. Nothing you play is kept until you switch this off." | |
| 3 | Close the browser completely and open it again. Play one video without clicking anything of The Key's. Then open the panel and export. | That play is in the export, with `recorded_with` "panel closed". | |
| 4 | Export your record. Then press "Erase everything in this browser" and confirm. Export again. | The first file carries `recorded_with` on every play made since this build. The second file's `D1_plays` is empty. | |
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
