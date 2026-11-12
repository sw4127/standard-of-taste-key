"use client";
/**
 * Naming music (T9.1, T9.2, T9.8): the nested bar for when a record found you, the optional year
 * and birth year, and "Add several at once". Shared by the website and the panel.
 */
import { useState } from "react";
import { FOUND_RANGES, litRanges, type Found, type NamedSong } from "../src/model";
import { parseTitle } from "../src/match/parse";
import { confirmSong } from "../src/sources/confirm";
import type { FetchFn } from "../src/sources/http";
import { searchSongs, type Candidate } from "../src/sources/musicbrainz";
import { actions, MAX_SONGS } from "./store";

const fetchFn: FetchFn = (url) => fetch(url);
const thisYear = () => new Date().getFullYear();

/** How wide each range is drawn: each inside the next, ending at now (the right-hand end). */
const WIDTH: Record<(typeof FOUND_RANGES)[number], number> = { "this month": 25, "this year": 50, "the last three years": 75, "longer ago": 100 };

/**
 * FR-T9.8: one bar of nested ranges, drawn one inside the next. He taps the narrowest range that is
 * true; the wider ones light with it, because a song that found him this month also found him this
 * year. "Can't say" sits beside. "Longer ago" asks, optionally, about which year.
 */
export function FoundBar({ entry, noun }: { entry: NamedSong; noun: "song" | "album" }) {
  const value = entry.found_me;
  const lit = litRanges(value);
  const pick = (f: Found) => actions.answer(entry.entry_id, "found_me", value === f ? "unanswered" : f);
  const legend = `When did this ${noun} find you?`;
  return (
    <fieldset className="choices stack">
      <legend className="label">{legend}</legend>
      <p className="meta">Tap the narrowest one that is true. A song that found you this month also found you this year, so the wider ones light with it.</p>
      <div className="found-bar" role="group" aria-label={legend}>
        {[...FOUND_RANGES].reverse().map((f) => (
          <button
            key={f}
            type="button"
            className={`found-range${lit.includes(f) ? " lit" : ""}`}
            style={{ width: `${WIDTH[f]}%` }}
            aria-pressed={value === f}
            onClick={() => pick(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="row">
        <button type="button" className="act choice" aria-pressed={value === "can't say"} onClick={() => pick("can't say")}>
          can&#39;t say
        </button>
      </div>
      {value === "longer ago" && (
        <label className="check">
          <span className="meta">About which year? (optional)</span>
          <input
            className="field year-field"
            type="number"
            inputMode="numeric"
            min={1900}
            max={thisYear()}
            value={entry.found_year ?? ""}
            onChange={(e) => {
              const y = Number(e.target.value);
              actions.foundYear(entry.entry_id, e.target.value && y >= 1900 && y <= thisYear() ? y : undefined);
            }}
          />
        </label>
      )}
    </fieldset>
  );
}

/** FR-T9.8: the optional birth year, kept in this browser, used only to say how old he was when a record found him. */
export function BirthYear({ value }: { value?: number }) {
  return (
    <div className="card stack">
      <label className="label" htmlFor="birth-year">
        The year you were born (optional)
      </label>
      <input
        id="birth-year"
        className="field year-field"
        type="number"
        inputMode="numeric"
        min={1900}
        max={thisYear()}
        value={value ?? ""}
        onChange={(e) => {
          const y = Number(e.target.value);
          actions.setBirthYear(e.target.value && y >= 1900 && y <= thisYear() ? y : undefined);
        }}
      />
      <p className="meta">It stays in this browser. It is used only to say how old you were when a record found you.</p>
    </div>
  );
}

/** One pasted line read as the matching rule reads a title, then as words for the search. */
export function lineQuery(line: string): string {
  const q = parseTitle(line).queries[0];
  if (q && (/《/.test(line) || /\s[-–]\s/.test(line))) return [q.track, q.artists[0]].filter(Boolean).join(" ");
  return line.replace(/[【】《》「」|｜]/g, " ").replace(/\s+/g, " ").trim();
}

type Found1 = { line: string; candidate: Candidate | null; ticked: boolean };

/**
 * FR-T9.1: "Add several at once": one title per line; each line is matched as a song (the matching
 * rule's reading, then the search); he ticks the right ones; lines with no match are listed as not found.
 */
export function SeveralAtOnce({ person, room }: { person: string; room: number }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Found1[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  if (!open) {
    return (
      <button type="button" className="act" onClick={() => setOpen(true)}>
        Add several at once
      </button>
    );
  }
  const find = async () => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, MAX_SONGS);
    const out: Found1[] = [];
    for (const [i, line] of lines.entries()) {
      setBusy(`Looking in MusicBrainz for line ${i + 1} of ${lines.length}.`);
      let candidate: Candidate | null = null;
      try {
        candidate = (await searchSongs(lineQuery(line), { fetchFn }))[0] ?? null;
      } catch {
        candidate = null;
      }
      out.push({ line, candidate, ticked: false });
    }
    setBusy(null);
    setRows(out);
  };
  const add = async () => {
    const chosen = (rows ?? []).filter((r) => r.ticked && r.candidate).slice(0, room);
    for (const [i, r] of chosen.entries()) {
      setBusy(`Adding ${i + 1} of ${chosen.length}.`);
      const c = await confirmSong(r.candidate!, r.line, { fetchFn });
      if (!("error" in c)) actions.addSong(c.facts, r.line, person, c.matched_by);
    }
    setBusy(null);
    setRows(null);
    setText("");
    setOpen(false);
  };
  const found = (rows ?? []).filter((r) => r.candidate);
  const missing = (rows ?? []).filter((r) => !r.candidate);
  return (
    <div className="stack">
      <label className="label" htmlFor="several">
        One song per line
      </label>
      <textarea id="several" className="field words-box" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Heat Waves - Glass Animals" />
      {!rows && (
        <div className="row">
          <button type="button" className="act" disabled={!text.trim() || busy !== null} onClick={find}>
            Find these songs
          </button>
          <button type="button" className="act" onClick={() => setOpen(false)}>
            Not now
          </button>
        </div>
      )}
      {busy && <p className="meta" role="status">{busy}</p>}
      {rows && (
        <>
          {found.length > 0 && (
            <fieldset className="choices stack">
              <legend className="label">Tick the ones that are right</legend>
              {found.map((r) => (
                <label key={r.line} className="check">
                  <input type="checkbox" checked={r.ticked} onChange={(e) => setRows(rows.map((x) => (x === r ? { ...x, ticked: e.target.checked } : x)))} />
                  <span className="record">
                    {r.candidate!.title} · {r.candidate!.artist_credit}
                    {r.candidate!.year ? ` · ${r.candidate!.year}` : ""}
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {missing.length > 0 && (
            <div className="stack">
              <p className="label">Not found</p>
              <ul className="plain">
                {missing.map((r) => (
                  <li key={r.line} className="record">
                    {r.line}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="row">
            <button type="button" className="act" disabled={!rows.some((r) => r.ticked) || busy !== null} onClick={add}>
              Add the ticked songs
            </button>
            <button type="button" className="act" onClick={() => setRows(null)}>
              Start again
            </button>
          </div>
        </>
      )}
    </div>
  );
}
