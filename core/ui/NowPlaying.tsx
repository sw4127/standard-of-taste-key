"use client";
/**
 * The panel beside a Bilibili video (moment map P-2, P-3; T1.2–T1.4). The status line names the song
 * at once when rule v6 is certain; when it is silent, "I can't tell which recording this is" with "Fix",
 * and no line about the song. "Fix" lists up to eight recordings and "Not a song"; one tap picks, and
 * every later play of the same video uses the pick. Each play is kept in D1 with its seconds heard.
 */
import { useEffect, useRef, useState } from "react";
import { normalise } from "../src/match/studio";
import { matchTitle, RULE_VERSION, type Candidate, type MatchResult } from "../src/match/v6";
import type { LivePage, PageFacts, PlayRow, SongFacts } from "../src/model";
import type { FetchFn } from "../src/sources/http";
import { recordingPage } from "../src/sources/musicbrainz";
import { actions, hydrate, useStore } from "./store";

const fetchFn: FetchFn = (url) => fetch(url);
const localNow = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
};
const videoKey = (f: PageFacts) => `${f.video_id}:${f.part_number}`;

function factsFrom(c: Candidate): SongFacts {
  const lead = c.lead;
  const y = c.first_release && /^\d{4}/.test(c.first_release) ? Number(c.first_release.slice(0, 4)) : undefined;
  return {
    recording_id: c.recording_id, title: c.title, artist_credit: c.artist_credit,
    lead_artist_id: lead?.id ?? normalise(c.artist_credit), lead_artist: lead?.name ?? c.artist_credit,
    first_release_year: y, date_source: recordingPage(c.recording_id), date_disputed: false, people: [],
  };
}

/** The pick a person made for this video before, if any: every later play of it uses it. */
export function earlierFix(plays: PlayRow[], f: PageFacts): PlayRow | undefined {
  return [...plays].reverse().find((p) => p.video_id === f.video_id && p.part_number === f.part_number && (p.match_state === "fixed by me" || p.match_state === "not a song"));
}

type Status = { kind: "reading" } | { kind: "match"; result: MatchResult | null } | { kind: "unreachable" };

export function NowPlaying({ live }: { live: LivePage & { facts: PageFacts } }) {
  const st = useStore();
  const f = live.facts;
  const key = videoKey(f);
  const [status, setStatus] = useState<Status>({ kind: "reading" });
  const [fixing, setFixing] = useState(false);
  const play = useRef<PlayRow | null>(null);
  const savedHeard = useRef(0);

  // A new viewing: one play, matched by the rule unless the person fixed this video before. A panel
  // reopened on the same viewing finds its play again by the page's token.
  useEffect(() => void hydrate(), []);
  useEffect(() => {
    if (!st.ready) return; // the plays kept in this browser come first: a fix may already hold
    let gone = false;
    setFixing(false);
    const again = st.plays.find((p) => p.play_id === `play-${live.play_token}`);
    if (again) {
      play.current = again;
      savedHeard.current = again.heard_seconds;
      setStatus({ kind: "match", result: null });
      return;
    }
    const fix = earlierFix(st.plays, f);
    const row: PlayRow = {
      play_id: `play-${live.play_token}`, source: "live page", video_id: f.video_id, part_number: f.part_number, page_title: f.page_title,
      uploader_name: f.uploader_name, uploader_id: f.uploader_id, list_title: f.list_title, list_position: f.list_position,
      page_tags: f.page_tags, started_at: localNow(), heard_seconds: live.heard_seconds, reached_end: live.ended ? "yes" : "no",
      recording_id: fix?.recording_id ?? "", match_state: fix?.match_state ?? "unsure", match_rule_version: RULE_VERSION,
      song_title: fix?.song_title, song_artist: fix?.song_artist,
    };
    play.current = row;
    savedHeard.current = live.heard_seconds;
    if (fix) {
      setStatus({ kind: "match", result: null });
      void actions.savePlay(row);
      return;
    }
    setStatus({ kind: "reading" });
    matchTitle(f.page_title, { fetchFn }).then(
      (result) => {
        if (gone) return;
        // Merge into the newest row: seconds heard may have been saved while the rule ran.
        const latest = play.current?.play_id === row.play_id ? play.current : row;
        if (result.state === "certain") {
          actions.keepRecording(factsFrom(result.candidate), "rule");
          play.current = { ...latest, recording_id: result.candidate.recording_id, match_state: "certain", song_title: result.candidate.title, song_artist: result.candidate.artist_credit };
        } else {
          play.current = latest;
        }
        void actions.savePlay(play.current);
        setStatus({ kind: "match", result });
      },
      () => {
        if (gone) return;
        void actions.savePlay(play.current ?? row);
        setStatus({ kind: "unreachable" });
      },
    );
    return () => {
      gone = true;
    };
  }, [st.ready, key, f.page_title, live.play_token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seconds heard: kept with the play every 5 seconds, and at a pause or the end.
  useEffect(() => {
    const row = play.current;
    if (!row) return;
    const ended = live.ended ? "yes" : row.reached_end;
    if (live.heard_seconds - savedHeard.current >= 5 || !live.playing || ended !== row.reached_end) {
      savedHeard.current = live.heard_seconds;
      play.current = { ...row, heard_seconds: Math.max(row.heard_seconds, live.heard_seconds), reached_end: ended };
      void actions.savePlay(play.current);
    }
  }, [live.heard_seconds, live.playing, live.ended]);

  const row = st.plays.find((p) => p.play_id === play.current?.play_id) ?? play.current;
  const pick = (c: Candidate | "not a song") => {
    if (!row) return;
    const next: PlayRow =
      c === "not a song"
        ? { ...row, match_state: "not a song", recording_id: "", song_title: undefined, song_artist: undefined }
        : { ...row, match_state: "fixed by me", recording_id: c.recording_id, song_title: c.title, song_artist: c.artist_credit };
    if (c !== "not a song") actions.keepRecording(factsFrom(c), "my fix");
    play.current = next;
    void actions.savePlay(next);
    setFixing(false);
  };

  const known = row && (row.match_state === "certain" || row.match_state === "fixed by me") && row.song_title;
  const candidates = status.kind === "match" && status.result ? status.result.candidates : [];

  return (
    <article className="card stack">
      <p className="label">Playing on Bilibili</p>
      <p className="meta">{f.page_title}</p>
      {status.kind === "reading" && !known && (
        <p className="record" role="status">
          Reading this video…
        </p>
      )}
      {known && (
        <p className="line" role="status">
          {row!.song_title} · {row!.song_artist}
          {row!.match_state === "fixed by me" && <span className="meta"> (your pick)</span>}
        </p>
      )}
      {row?.match_state === "not a song" && (
        <p className="record" role="status">
          Not a song, as you said.
        </p>
      )}
      {status.kind !== "reading" && !known && row?.match_state !== "not a song" && (
        <p className="record" role="status">
          I can&#39;t tell which recording this is.
          {status.kind === "unreachable" && " MusicBrainz did not answer."}
        </p>
      )}
      {status.kind !== "reading" && (
        <button type="button" className="act" aria-expanded={fixing} onClick={() => setFixing((x) => !x)}>
          {fixing ? "Close" : "Fix"}
        </button>
      )}
      {fixing && (
        <FixList
          title={f.page_title}
          initial={candidates}
          onPick={pick}
        />
      )}
    </article>
  );
}

/** FR-T1.4: up to eight recordings (title, artist, first release, record), and "Not a song". */
function FixList({ title, initial, onPick }: { title: string; initial: Candidate[]; onPick: (c: Candidate | "not a song") => void }) {
  const [list, setList] = useState<Candidate[] | null>(initial.length ? initial : null);
  useEffect(() => {
    if (list) return;
    // A play matched from an earlier pick has no candidates yet: search once.
    matchTitle(title, { fetchFn }).then((r) => setList(r.candidates), () => setList([]));
  }, [list, title]);
  return (
    <div className="stack">
      {list === null && <p className="meta" role="status">Looking in MusicBrainz…</p>}
      {list && list.length === 0 && <p className="meta">MusicBrainz offers no recording for this title.</p>}
      {list && list.length > 0 && (
        <ul className="plain stack" aria-label="Recordings to pick from">
          {list.slice(0, 8).map((c) => (
            <li key={c.recording_id}>
              <button type="button" className="act" onClick={() => onPick(c)}>
                {c.title} · {c.artist_credit} · {c.first_release ?? "date not listed"}
                {c.record ? ` · ${c.record}` : ""}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="act" onClick={() => onPick("not a song")}>
        Not a song
      </button>
    </div>
  );
}
