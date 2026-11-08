"use client";
/**
 * "Where next?" (FR-T4.5; moment map P-9): one next record with its reasons in order, one track to start
 * with, a Bilibili search and the uploader's page that open only on a tap, and "What critics said"
 * behind a further tap. Never pushed mid-song: it appears on a tap, or when the song ends after at
 * least two other songs in the session.
 */
import { useEffect, useState } from "react";
import { friendLine } from "../src/firstwords";
import type { NextRow, PlayRow, SongFacts } from "../src/model";
import { criticsOf, dueAtEnd, findRecord, finishedByArtist, FINISHED_FOR_NEW, newRecord, ordered, searchLink, startTrack, tracksOf, uploaderLink, uploaderReason } from "../src/nextrecord";
import type { FetchFn } from "../src/sources/http";
import { actions, useStore } from "./store";

const fetchFn: FetchFn = (url) => fetch(url);
const localNow = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
};

type State = { kind: "idle" } | { kind: "looking" } | { kind: "none" } | { kind: "shown"; row: NextRow };

export function WhereNext({ song, play }: { song: SongFacts; play: PlayRow }) {
  const st = useStore();
  const [s, setS] = useState<State>({ kind: "idle" });
  const [critics, setCritics] = useState<null | "looking" | Awaited<ReturnType<typeof criticsOf>>>(null);
  const atEnd = dueAtEnd(st.plays, play);

  const suggest = async () => {
    setS({ kind: "looking" });
    try {
      const d = { fetchFn };
      const up = uploaderReason(st.plays, play);
      const friend = friendLine(st.histories, st.people, song.lead_artist);
      const done = finishedByArtist(st.plays, st.facts, song.lead_artist_id);
      const fresh = done.length >= FINISHED_FOR_NEW ? await newRecord(song.lead_artist_id, new Date(), d) : null;
      const rg = fresh ?? (friend?.record ? await findRecord(friend.record, song.lead_artist_id, d) : null);
      if (!rg) return setS({ kind: "none" });
      const reasons: NextRow["reasons"] = [];
      if (up) reasons.push(up);
      if (friend?.record && friend.record.toLowerCase() === rg.title.toLowerCase()) {
        reasons.push({ kind: "trusted_judge", text: `${friend.text} This is the record they played most.`, evidence: friend.proof.map((p) => p.text) });
      }
      if (fresh && rg.id === fresh.id) {
        reasons.push({ kind: "artist_new", text: `A new record by ${song.lead_artist} (${fresh["first-release-date"]}); you have played ${done.length} of their songs to the end.`, evidence: done.map((r) => st.facts[r]?.title ?? r) });
      }
      const why = ordered(reasons);
      if (!why.some((r) => r.kind !== "uploader")) return setS({ kind: "none" });
      const { tracks, singles } = await tracksOf(rg.id, song.lead_artist_id, d);
      const start = startTrack(tracks, singles);
      const row: NextRow = {
        suggestion_id: `next-${play.play_id}-${rg.id}`, from_recording_id: song.recording_id, play_id: play.play_id, release_group_id: rg.id,
        record_title: rg.title, artist: song.lead_artist, first_release: rg["first-release-date"], start_track_recording_id: start?.recording_id,
        start_track_title: start?.title, track_recording_ids: tracks.map((t) => t.recording_id), reasons: why,
        ...(play.uploader_id ? { uploader_id: play.uploader_id } : {}), shown_at: localNow(),
      };
      void actions.saveNext(row);
      actions.log("next_shown", { play_id: play.play_id, value: rg.title });
      setS({ kind: "shown", row });
    } catch {
      setS({ kind: "none" });
    }
  };

  // At a song's end, inside a run of three or more songs, the next record comes by itself.
  useEffect(() => {
    if (atEnd && s.kind === "idle") void suggest();
  }, [atEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  const row = s.kind === "shown" ? st.nexts.find((n) => n.suggestion_id === s.row.suggestion_id) ?? s.row : null;
  return (
    <div className="stack">
      {s.kind === "idle" && (
        <button type="button" className="act" onClick={() => void suggest()}>
          Where next?
        </button>
      )}
      {s.kind === "looking" && <p className="meta" role="status">Looking for a next record…</p>}
      {s.kind === "none" && <p className="record">No next record to suggest yet.</p>}
      {row && (
        <div className="evidence stack">
          <p className="label">Where next</p>
          <p className="line">
            {row.record_title} · {row.artist}
            {row.first_release ? ` · ${row.first_release.slice(0, 4)}` : ""}
          </p>
          {row.start_track_title && <p className="record">Start with “{row.start_track_title}”.</p>}
          <ul className="plain stack">
            {row.reasons.map((r) => (
              <li key={r.kind} className="record">
                {r.text}
              </li>
            ))}
          </ul>
          <div className="row">
            <a
              className="act"
              href={searchLink(row.artist, row.record_title)}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                actions.log("next_search_opened", { play_id: play.play_id, value: row.record_title });
                if (!row.search_opened_at) void actions.saveNext({ ...row, search_opened_at: localNow() });
              }}
            >
              Search Bilibili for it
            </a>
            {row.uploader_id && row.reasons.some((r) => r.kind === "uploader") && (
              <a
                className="act"
                href={uploaderLink(row.uploader_id)}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  actions.log("uploader_opened", { play_id: play.play_id });
                  if (!row.uploader_opened_at) void actions.saveNext({ ...row, uploader_opened_at: localNow() });
                }}
              >
                The uploader&#39;s page
              </a>
            )}
            <button
              type="button"
              className="act"
              onClick={() => {
                if (critics) return setCritics(null);
                setCritics("looking");
                criticsOf(row.release_group_id, { fetchFn }).then(setCritics, () => setCritics({ reviews: [], scores: [] }));
              }}
            >
              What critics said
            </button>
          </div>
          {critics === "looking" && <p className="meta" role="status">Looking…</p>}
          {critics && critics !== "looking" && (
            <div className="stack">
              {critics.reviews.length === 0 && critics.scores.length === 0 && <p className="record">MusicBrainz and Wikidata list no reviews for this record.</p>}
              {critics.scores.map((sc, i) => (
                <p key={i} className="record">
                  {sc.by}: {sc.score} ·{" "}
                  <a className="act" href={sc.source} target="_blank" rel="noreferrer">
                    Wikidata
                  </a>
                </p>
              ))}
              {critics.reviews.map((u) => (
                <p key={u} className="record">
                  <a className="act" href={u} target="_blank" rel="noreferrer">
                    {new URL(u).hostname.replace(/^www\./, "")}
                  </a>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
