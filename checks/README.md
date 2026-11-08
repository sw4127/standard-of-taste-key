# checks/

Never shipped with the extension or the website.

## The launch gate (T8.3)

Fifty titles from a Bilibili uploader list page the matching rule has never seen, from an uploader
other than "百万豪装录音棚大声听" (whose lists tuned rule v6). Rule v6 matches each one against
MusicBrainz; Bob marks every match. **The gate passes only with 0 wrong or unprovable songs, artists or
versions.** A doubtful release date is noted beside the result and never counted. Coverage (how many
titles matched) is reported, not gated. Even a pass leaves the true wrong-key rate as high as about 6%
(rule of three: 3 ÷ 50).

How it runs:

1. Start the sheet: `npm run gate`, then open http://localhost:3214 (Claude starts it on request).
2. Name the uploader and the list; paste 50 titles, one per line. Durations, counts and dates copied
   with them are left out; titles the rule was tuned on are refused.
3. "Run rule v6": one MusicBrainz call every 1.2 s, about a minute or two.
4. Mark every match: check the song, then the artist, then the version; the first that is wrong is the
   mark. "Can't prove all three" when nothing is shown wrong but something cannot be shown right.
5. "Download the sheet": a Markdown file, saved into this folder as `launch-gate-YYYY-MM-DD.md` and
   committed. The panel is used for Bob's verdict only after the gate passes.

Marks are kept in that browser between visits; nothing goes anywhere but MusicBrainz's search.

## Other checks

- `live-sources.test.ts` (LIVE=1): do MusicBrainz and AcousticBrainz still answer as the code expects.
- `record-mb.test.ts` (RECORD=1): re-record the MusicBrainz replies the match fixtures replay.
- `lookback-scale.test.ts` (SCALE=1): reading a synthetic 90,000-play export.
