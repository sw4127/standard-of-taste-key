"use client";
/**
 * "Judge these lines" (FR-CORE-4), for lines across named songs and for look-back lines: the check-A
 * sheet (five answers, each line judged by the person it is about) and the swap test (lines from two
 * people mixed, whose they are hidden). Answers are kept in this browser (D9); the counts and the pass
 * rule are computed by code and shown as counts, never as a verdict on anyone.
 */
import { useEffect, useMemo, useState } from "react";
import { CHECK_A, isCheckA, mix, SWAP, swapResult, tallyCheckA, type CheckA, type Swap } from "../src/judge";
import { defaultStretch, lookBack } from "../src/lookback";
import { linesAcross } from "../src/patterns";
import { judgeSource, type JudgeSource } from "./judge-source";
import { lookBackQuestion } from "./LookBack";
import { Go } from "./nav";
import { actions, hydrate, ME, songsOf, useStore, type State } from "./store";

interface Line {
  id: string;
  pattern: string;
  gloss?: string;
}

function linesOf(st: State, source: JudgeSource, person: string): Line[] {
  if (source === "named songs") return linesAcross(songsOf(st, person));
  const rows = st.histories[person];
  const q = rows?.length ? defaultStretch(rows) : null;
  return rows && q ? lookBack(rows, q).map((l) => ({ id: lookBackQuestion(q, l), pattern: l.pattern })) : [];
}

const nameOf = (st: State, p: string) => (p === ME ? "you" : st.people.find((x) => x.person_id === p)?.label ?? "someone");

function LineToJudge<T extends string>({ line, options, value, onPick }: { line: Line; options: readonly T[]; value?: string; onPick: (v: T) => void }) {
  return (
    <li className="card stack">
      <p className="line">{line.pattern}</p>
      {line.gloss && <p className="record">{line.gloss}</p>}
      <div className="chip-row" role="group" aria-label="Your answer">
        {options.map((o) => (
          <button key={o} type="button" className="act act-button" aria-pressed={value === o} onClick={() => onPick(o)}>
            {o}
          </button>
        ))}
      </div>
    </li>
  );
}

const answerOf = (st: State, kind: "check_a_answered" | "swap_answered", line: string, owner: string, judge: string) =>
  st.events.find((e) => e.kind === kind && e.question_id === line && e.person_id === owner && e.judge_id === judge)?.value;

function PersonPicker({ label, people, value, onPick, st }: { label: string; people: string[]; value: string; onPick: (p: string) => void; st: State }) {
  if (people.length < 2) return null;
  return (
    <div className="chip-row" role="group" aria-label={label}>
      <span className="label">{label}</span>
      {people.map((p) => (
        <button key={p} type="button" className="act act-button" aria-pressed={value === p} onClick={() => onPick(p)}>
          {p === ME ? "Me" : nameOf(st, p)}
        </button>
      ))}
    </div>
  );
}

export function Judge() {
  const st = useStore();
  useEffect(() => void hydrate(), []);
  const hasHistories = Object.values(st.histories).some((r) => r.length > 0);
  const [source, setSource] = useState<JudgeSource>(judgeSource);
  const src: JudgeSource = source === "look-back" && !hasHistories ? "named songs" : source;

  const everyone = useMemo(() => [ME, ...st.people.map((p) => p.person_id).filter((p) => p !== ME)], [st.people]);
  const byPerson = useMemo(() => Object.fromEntries(everyone.map((p) => [p, linesOf(st, src, p)])), [st, src, everyone]);
  const withLines = everyone.filter((p) => byPerson[p]!.length > 0);

  const [aPerson, setAPerson] = useState<string | null>(null);
  const checkOwner = aPerson && withLines.includes(aPerson) ? aPerson : withLines[0] ?? ME;
  const first = withLines.includes(ME) ? ME : withLines[0];
  const [otherId, setOtherId] = useState<string | null>(null);
  const second = withLines.find((p) => p === otherId && p !== first) ?? withLines.find((p) => p !== first);
  const [judgeId, setJudgeId] = useState<string | null>(null);
  const judge = second && judgeId === second ? second : first ?? ME;
  const mixed = useMemo(() => (first && second ? mix(byPerson[first]!, byPerson[second]!, first, second) : []), [byPerson, first, second]);
  // The swap test first, on its own: check A lists the person's own lines, which would give it away.
  const [tab, setTab] = useState<"swap" | "check-a" | null>(null);

  if (!st.ready) return <p className="meta" role="status">Reading what this browser keeps…</p>;

  const shown = tab ?? (second ? "swap" : "check-a");
  const mine = byPerson[checkOwner] ?? [];
  const answeredA = mine
    .map((l) => ({ line_id: l.id, owner: checkOwner, value: answerOf(st, "check_a_answered", l.id, checkOwner, checkOwner) }))
    .filter((a): a is { line_id: string; owner: string; value: CheckA } => isCheckA(a.value));
  const tally = tallyCheckA(answeredA);

  const answeredS = mixed
    .map((m) => ({ line_id: m.line.id, owner: m.owner, value: answerOf(st, "swap_answered", m.line.id, m.owner, judge) as Swap | undefined }))
    .filter((a): a is { line_id: string; owner: string; value: Swap } => !!a.value);
  const result = swapResult(answeredS, judge);
  const otherOfJudge = judge === first ? second : first;
  const whose = (p: string | undefined) => (p === ME ? "your" : `${nameOf(st, p ?? "")}'s`);
  const what = src === "named songs" ? "songs" : "file";

  return (
    <section className="stack-lg">
      <p className="line">Judge these lines</p>
      {hasHistories && (
        <div className="chip-row" role="group" aria-label="Which lines">
          <button type="button" className="act act-button" aria-pressed={src === "named songs"} onClick={() => setSource("named songs")}>
            Lines across named songs
          </button>
          <button type="button" className="act act-button" aria-pressed={src === "look-back"} onClick={() => setSource("look-back")}>
            Look-back lines
          </button>
        </div>
      )}
      <div className="chip-row" role="group" aria-label="Which test">
        <button type="button" className="act act-button" aria-pressed={shown === "swap"} onClick={() => setTab("swap")}>
          The swap test
        </button>
        <button type="button" className="act act-button" aria-pressed={shown === "check-a"} onClick={() => setTab("check-a")}>
          Check A
        </button>
      </div>
      {second && <p className="meta">Do the swap test before check A: check A shows whose lines are whose.</p>}
      {src === "look-back" && <p className="meta">Look-back lines here use each file&#39;s most recent full quarter.</p>}

      {shown === "check-a" && (
        <>
          <p className="label">Check A: one answer for each line, by the person it is about</p>
          <PersonPicker label="Whose lines" people={withLines} value={checkOwner} onPick={setAPerson} st={st} />
          {mine.length === 0 ? (
            <p className="record">
              No lines yet. {src === "named songs" ? <Go to="songs">Name a few songs</Go> : <Go to="look-back">Open the look back</Go>}
            </p>
          ) : (
            <ul className="plain stack">
              {mine.map((l) => (
                <LineToJudge
                  key={l.id}
                  line={l}
                  options={CHECK_A}
                  value={answerOf(st, "check_a_answered", l.id, checkOwner, checkOwner)}
                  onPick={(v) => actions.judge({ kind: "check_a_answered", question_id: l.id, person_id: checkOwner, judge_id: checkOwner, value: v, line_text: l.pattern })}
                />
              ))}
            </ul>
          )}
          {answeredA.length > 0 && (
            <div className="card stack">
              <p className="label">Answers so far ({answeredA.length} of {mine.length} lines)</p>
              <ul className="plain">
                {CHECK_A.map((a) => (
                  <li key={a} className="record">
                    {a}: {tally[a]}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {shown === "swap" && (
        <>
          <p className="label">The swap test: lines from two people, mixed</p>
          {!first || !second ? (
            <p className="record">
              {src === "named songs"
                ? "The swap test needs a second person with three or more songs. On the songs page, use “Add someone else's songs”."
                : "The swap test needs a second person's Spotify file. In the look back, use “Read another file”."}
            </p>
          ) : (
            <>
              <PersonPicker label="Mixed with" people={withLines.filter((p) => p !== first)} value={second} onPick={setOtherId} st={st} />
              <PersonPicker label="Who is answering?" people={[first, second]} value={judge} onPick={setJudgeId} st={st} />
              <p className="record">Whose each line is stays hidden. For each line: is it yours?</p>
              <ul className="plain stack">
                {mixed.map((m) => (
                  <LineToJudge
                    key={`${m.owner}:${m.line.id}`}
                    line={m.line}
                    options={SWAP}
                    value={answerOf(st, "swap_answered", m.line.id, m.owner, judge)}
                    onPick={(v) => actions.judge({ kind: "swap_answered", question_id: m.line.id, person_id: m.owner, judge_id: judge, value: v, line_text: m.line.pattern })}
                  />
                ))}
              </ul>
              {answeredS.length === mixed.length && mixed.length > 0 && (
                <div className="card stack">
                  <p className="label">The swap test, answered by {nameOf(st, judge)}</p>
                  <p className="record">
                    Lines from {whose(judge)} {what} marked Mine: {result.own.mine} of {result.own.of}. It passes when at least half are.
                  </p>
                  <p className="record">
                    Lines from {whose(otherOfJudge)} {what} marked Mine: {result.other.mine} of {result.other.of}. It passes when one or none are.
                  </p>
                  <p className="record">{result.passes ? "The swap test passes." : "The swap test does not pass."}</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
