"use client";
/**
 * The panel beside a Bilibili video (moment map P-2, P-3; T1.2–T1.4). The status line names the song
 * at once when rule v7 is certain; when it is silent, one line says why (FR-CORE-1 v7, step 5), with "Fix",
 * and no line about the song. "Fix" lists up to eight recordings and "Not a song"; one tap picks, and
 * every later play of the same video uses the pick. Each play is kept in D1 with its seconds heard.
 * A matched song's credits and facts are fetched at once (T2.1) and its words follow (SongWords).
 */
import { useEffect, useRef, useState } from "react";
import { normalise } from "../src/match/studio";
import { fixFor, fixTyped, type FixList as FixListData, type FixRow } from "../src/match/fix";
import { lastChecks, matchTitle, RULE_VERSION, silenceLine, type Candidate, type MatchResult } from "../src/match/v7";
import type { LivePage, PageFacts, PlayRow, SongFacts } from "../src/model";
import type { FetchFn } from "../src/sources/http";
import { recordingPage } from "../src/sources/musicbrainz";
import { recordingFacts } from "../src/sources/recording";
import { edgeClass, edgeStyle } from "./KeyChip";
import { SongWords } from "./SongWords";
import { actions, getState, hydrate, useStore } from "./store";

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

/** FR-T2.1: the status line uses the candidate's facts at once; credits, places, key and tempo follow. */
function keepWithFacts(c: Candidate, matched_by: "rule" | "my fix", play_id?: string) {
  actions.keepRecording(factsFrom(c), matched_by);
  if (play_id) noticeLaterPlay(c.recording_id, play_id);
  void recordingFacts(c, { fetchFn }).then((full) => actions.keepRecording(full, matched_by));
}

/** FR-T4.5: a later play of a track from a suggested record is marked on that suggestion (D7). */
function noticeLaterPlay(recording_id: string, play_id: string) {
  for (const n of getState().nexts) {
    if (!n.later_played_play_id && n.play_id !== play_id && n.track_recording_ids.includes(recording_id)) void actions.saveNext({ ...n, later_played_play_id: play_id });
  }
}

/** The pick a person made for this video before, if any: every later play of it uses it. */
export function earlierFix(plays: PlayRow[], f: PageFacts): PlayRow | undefined {
  return [...plays].reverse().find((p) => p.video_id === f.video_id && p.part_number === f.part_number && (p.match_state === "fixed by me" || p.match_state === "not a song"));
}

/**
 * The play kept for this viewing (the page's token), and whether it was matched on the title the page
 * shows now. Bilibili can change the address before it redraws the title, so a viewing's first title
 * may be the last video's: a viewing whose title has changed is matched again (Bob's five-video check).
 */
export function viewingFor(plays: PlayRow[], play_token: string, page_title: string): { row?: PlayRow; sameTitle: boolean } {
  const row = plays.find((p) => p.play_id === `play-${play_token}`);
  return { row, sameTitle: !!row && row.page_title === page_title };
}

type Status ={ kind: "reading" } | { kind: "match"; result: MatchResult | null } | { kind: "unreachable" };

export function NowPlaying({ live }: { live: LivePage & { facts: PageFacts } }) {
  const st = useStore();
  const f = live.facts;
  const key = videoKey(f);
  const [status, setStatus] = useState<Status>({ kind: "reading" });
  const [fixing, setFixing] = useState(false);
  const play = useRef<PlayRow | null>(null);
  /** The rule's own result for this viewing, so a length the player reports later can still be checked. */
  const ruled = useRef<MatchResult | null>(null);
  /** The play as it was before the last pick, so that "Undo" can put it back. */
  const beforePick = useRef<PlayRow | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const savedHeard = useRef(0);

  // A new viewing: one play, matched by the rule unless the person fixed this video before. A panel
  // reopened on the same viewing finds its play again by the page's token.
  useEffect(() => void hydrate(), []);
  useEffect(() => {
    if (!st.ready) return; // the plays kept in this browser come first: a fix may already hold
    let gone = false;
    setFixing(false);
    setCanUndo(false);
    beforePick.current = null;
    ruled.current = null;
    const { row: again, sameTitle } = viewingFor(st.plays, live.play_token, f.page_title);
    if (again && sameTitle) {
      play.current = again;
      savedHeard.current = again.heard_seconds;
      setStatus({ kind: "match", result: null });
      return;
    }
    const fix = earlierFix(st.plays, f);
    const row: PlayRow = {
      play_id: `play-${live.play_token}`, source: "live page", video_id: f.video_id, part_number: f.part_number, page_title: f.page_title,
      uploader_name: f.uploader_name, uploader_id: f.uploader_id, list_title: f.list_title, list_position: f.list_position,
      page_tags: f.page_tags, started_at: again?.started_at ?? localNow(), heard_seconds: Math.max(again?.heard_seconds ?? 0, live.heard_seconds),
      reached_end: live.ended ? "yes" : "no",
      recording_id: fix?.recording_id ?? "", match_state: fix?.match_state ?? "unsure", match_rule_version: RULE_VERSION,
      song_title: fix?.song_title, song_artist: fix?.song_artist,
    };
    play.current = row;
    savedHeard.current = row.heard_seconds;
    if (again) void actions.savePlay(row); // the match made on the stale title is cleared at once
    else actions.log("song_started", { play_id: row.play_id });
    if (fix) {
      setStatus({ kind: "match", result: null });
      void actions.savePlay(row);
      actions.log("key_ready", { play_id: row.play_id, value: fix.match_state });
      return;
    }
    setStatus({ kind: "reading" });
    matchTitle(f.page_title, { fetchFn }, { videoSeconds: live.duration_seconds }).then(
      (result) => {
        if (gone) return;
        // Merge into the newest row: seconds heard may have been saved while the rule ran.
        const latest = play.current?.play_id === row.play_id ? play.current : row;
        if (result.state === "certain") {
          keepWithFacts(result.candidate, "rule", row.play_id);
          play.current = { ...latest, recording_id: result.candidate.recording_id, match_state: "certain", song_title: result.candidate.title, song_artist: result.candidate.artist_credit };
        } else {
          play.current = latest;
        }
        void actions.savePlay(play.current);
        actions.log("key_ready", { play_id: row.play_id, value: result.state === "certain" ? "certain" : `silent: ${result.reason}` });
        setStatus({ kind: "match", result });
        ruled.current = result;
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

  // Rule v7.2: the player may report the video's length only after the rule has named a song. If the
  // recording is then more than 30 seconds longer or shorter, the song is taken back and the card is silent.
  useEffect(() => {
    const r = ruled.current;
    const row = play.current;
    if (!r || r.state !== "certain" || !live.duration_seconds || !row || row.match_state !== "certain") return;
    const checked = lastChecks(f.page_title, r, { videoSeconds: live.duration_seconds });
    if (checked.state === "certain") return;
    ruled.current = checked;
    play.current = { ...row, recording_id: "", match_state: "unsure", song_title: undefined, song_artist: undefined };
    void actions.savePlay(play.current);
    actions.log("key_ready", { play_id: row.play_id, value: `silent: ${checked.reason}` });
    setStatus({ kind: "match", result: checked });
  }, [live.duration_seconds]); // eslint-disable-line react-hooks/exhaustive-deps

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
    beforePick.current = row;
    const next: PlayRow =
      c === "not a song"
        ? { ...row, match_state: "not a song", recording_id: "", song_title: undefined, song_artist: undefined }
        : { ...row, match_state: "fixed by me", recording_id: c.recording_id, song_title: c.title, song_artist: c.artist_credit };
    if (c !== "not a song") keepWithFacts(c, "my fix", next.play_id);
    play.current = next;
    void actions.savePlay(next);
    actions.log("match_fixed", { play_id: next.play_id, value: next.match_state });
    setFixing(false);
    setCanUndo(true);
  };

  const undo = () => {
    const back = beforePick.current;
    if (!back || !row || back.play_id !== row.play_id) return;
    // Seconds heard since the pick are kept; only the pick itself is taken back.
    const next: PlayRow = { ...back, heard_seconds: Math.max(back.heard_seconds, row.heard_seconds), reached_end: row.reached_end };
    play.current = next;
    void actions.savePlay(next);
    actions.log("match_fixed", { play_id: next.play_id, value: "undone" });
    beforePick.current = null;
    setCanUndo(false);
  };

  const known = row && (row.match_state === "certain" || row.match_state === "fixed by me") && row.song_title;

  return (
    <article className={`card stack${known ? edgeClass(st.facts[row!.recording_id]?.key) : ""}`} style={known ? edgeStyle(st.facts[row!.recording_id]?.key) : {}}>
      <p className="label">Playing on Bilibili</p>
      <p className="meta">{f.page_title}</p>
      {status.kind === "reading" && !known && (
        <p className="record" role="status">
          Reading this video…
        </p>
      )}
      {known && (
        <div role="status" className="stack">
          <p className="song-title">{row!.song_title}</p>
          <p className="artist">{row!.song_artist}</p>
          {row!.match_state === "fixed by me" && (
            <p className="meta">
              This recording is your pick.{" "}
              {canUndo && beforePick.current?.play_id === row!.play_id && (
                <button type="button" className="act" onClick={undo}>
                  Undo
                </button>
              )}
            </p>
          )}
        </div>
      )}
      {row?.match_state === "not a song" && (
        <p className="record" role="status">
          Not a song, as you said.{" "}
          {canUndo && beforePick.current?.play_id === row.play_id && (
            <button type="button" className="act" onClick={undo}>
              Undo
            </button>
          )}
        </p>
      )}
      {status.kind !== "reading" && !known && row?.match_state !== "not a song" && (
        <p className="record" role="status">
          {status.kind === "unreachable"
            ? "I couldn't reach MusicBrainz, so this song is not named."
            : status.kind === "match" && status.result
              ? silenceLine(status.result)
              : "No song is named for this video."}
        </p>
      )}
      {status.kind !== "reading" && (
        <button type="button" className="act" aria-expanded={fixing} onClick={() => setFixing((x) => !x)}>
          {fixing ? "Close the list" : known ? "Not this recording? Fix" : "Fix"}
        </button>
      )}
      {fixing && (
        <FixList title={f.page_title} videoSeconds={live.duration_seconds} onPick={pick} />
      )}
      {known && row && st.facts[row.recording_id] && (
        <SongWords key={`${row.play_id}:${row.recording_id}`} song={st.facts[row.recording_id]!} play={row} heard={live.heard_seconds} />
      )}
    </article>
  );
}

/** One row of the Fix list: what the recording is in plain words, then its facts; one tap keeps it. */
function FixRowButton({ row, onPick }: { row: FixRow; onPick: (c: Candidate) => void }) {
  return (
    <li>
      <button type="button" className="act fix-row" onClick={() => onPick(row.candidate)}>
        <span className="fix-label">
          {row.label}
          {row.sameLength ? " · same length as this video" : ""}
        </span>
        <span className="fix-facts">{row.facts.join(" · ")}</span>
      </button>
    </li>
  );
}

/**
 * FR-T1.4 (as replaced 2026-11-10): the studio original by the artist read from the title comes first;
 * every other row says what it is; other artists' songs appear only under their own heading; a box
 * searches by typing; "Not a song" stays one tap away.
 */
function FixList({ title, videoSeconds, onPick }: { title: string; videoSeconds?: number; onPick: (c: Candidate | "not a song") => void }) {
  const [list, setList] = useState<FixListData | null | "unreachable">(null);
  const [typed, setTyped] = useState("");
  const [found, setFound] = useState<FixRow[] | null | "looking" | "unreachable">(null);
  useEffect(() => {
    let gone = false;
    setList(null);
    fixFor(title, { fetchFn }, videoSeconds).then((l) => !gone && setList(l), () => !gone && setList("unreachable"));
    return () => {
      gone = true;
    };
  }, [title]); // eslint-disable-line react-hooks/exhaustive-deps
  const search = () => {
    if (typed.trim().length < 2) return;
    setFound("looking");
    fixTyped(typed, { fetchFn }, videoSeconds).then(setFound, () => setFound("unreachable"));
  };
  return (
    <div className="stack evidence">
      {list === null && <p className="meta" role="status">Looking in MusicBrainz.</p>}
      {list === "unreachable" && <p className="meta" role="status">I couldn&#39;t reach MusicBrainz. You can still type the song below.</p>}
      {list && list !== "unreachable" && list.rows.length === 0 && <p className="meta">MusicBrainz has no recording under this title.</p>}
      {list && list !== "unreachable" && list.rows.length > 0 && (
        <>
          <p className="label">{list.heading ?? "Recordings to pick from"}</p>
          {list.heading && <p className="meta">MusicBrainz has no recording of this title by the artist named in the video&#39;s title. These are other artists&#39; songs with the same title.</p>}
          <ul className="plain stack" aria-label={list.heading ?? "Recordings to pick from"}>
            {list.rows.map((r) => (
              <FixRowButton key={r.candidate.recording_id} row={r} onPick={onPick} />
            ))}
          </ul>
        </>
      )}
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <label className="label" htmlFor="fix-typed">
          Type the song and the artist
        </label>
        <input id="fix-typed" className="field" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        <button type="submit" className="act" disabled={typed.trim().length < 2}>
          Search MusicBrainz
        </button>
      </form>
      {found === "looking" && <p className="meta" role="status">Looking in MusicBrainz.</p>}
      {found === "unreachable" && <p className="meta" role="status">I couldn&#39;t reach MusicBrainz. Try again in a moment.</p>}
      {Array.isArray(found) && found.length === 0 && <p className="meta" role="status">MusicBrainz has no recording matching what you typed.</p>}
      {Array.isArray(found) && found.length > 0 && (
        <ul className="plain stack" aria-label="Recordings found for what you typed">
          {found.map((r) => (
            <FixRowButton key={r.candidate.recording_id} row={r} onPick={onPick} />
          ))}
        </ul>
      )}
      <button type="button" className="act" onClick={() => onPick("not a song")}>
        Not a song
      </button>
    </div>
  );
}
