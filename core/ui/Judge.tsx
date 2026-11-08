"use client";
/**
 * "Judge these lines" (FR-CORE-4): the check-A sheet, four answers per line, and the swap test, lines
 * from two people's songs mixed with whose they are hidden. Answers are kept in this browser (D9);
 * the counts and the pass rule are computed by code and shown as counts, never as a verdict on anyone.
 */
import { useEffect, useMemo, useState } from "react";
import { CHECK_A, mix, SWAP, swapResult, tallyCheckA, type CheckA, type Swap } from "../src/judge";
import { linesAcross, type PatternLine } from "../src/patterns";
import { Go } from "./nav";
import { actions, hydrate, ME, others, songsOf, useStore, type State } from "./store";

function LineToJudge<T extends string>({ line, options, value, onPick }: { line: PatternLine; options: readonly T[]; value?: string; onPick: (v: T) => void }) {
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

export function Judge() {
  const st = useStore();
  useEffect(() => void hydrate(), []);
  const mine = useMemo(() => linesAcross(songsOf(st, ME)), [st]);
  const people = others(st).filter((p) => linesAcross(songsOf(st, p.person_id)).length > 0);
  const [otherId, setOtherId] = useState<string | null>(null);
  const other = people.find((p) => p.person_id === otherId) ?? people[0];
  const [judge, setJudge] = useState(ME);
  // The swap test first, on its own: check A lists the person's own lines, which would give it away.
  const [tab, setTab] = useState<"swap" | "check-a" | null>(null);
  const theirs = useMemo(() => (other ? linesAcross(songsOf(st, other.person_id)) : []), [st, other]);
  const mixed = useMemo(() => (other ? mix(mine, theirs, ME, other.person_id) : []), [mine, theirs, other]);

  if (!st.ready) return <p className="meta" role="status">Reading what this browser keeps…</p>;

  const checkA = mine.map((l) => ({ line_id: l.id, owner: ME, value: answerOf(st, "check_a_answered", l.id, ME, ME) as CheckA | undefined }));
  const answeredA = checkA.filter((a): a is { line_id: string; owner: string; value: CheckA } => !!a.value);
  const tally = tallyCheckA(answeredA);

  const swaps = mixed.map((m) => ({ line_id: m.line.id, owner: m.owner, value: answerOf(st, "swap_answered", m.line.id, m.owner, judge) as Swap | undefined }));
  const answeredS = swaps.filter((a): a is { line_id: string; owner: string; value: Swap } => !!a.value);
  const result = swapResult(answeredS, judge);
  const judgeLabel = judge === ME ? "you" : other?.label ?? "";
  const otherLabel = judge === ME ? other?.label ?? "" : "you";

  const shown = tab ?? (other ? "swap" : "check-a");

  return (
    <section className="stack-lg">
      <p className="line">Judge these lines</p>
      <div className="chip-row" role="group" aria-label="Which test">
        <button type="button" className="act act-button" aria-pressed={shown === "swap"} onClick={() => setTab("swap")}>
          The swap test
        </button>
        <button type="button" className="act act-button" aria-pressed={shown === "check-a"} onClick={() => setTab("check-a")}>
          Check A
        </button>
      </div>
      {other && <p className="meta">Do the swap test before check A: check A shows which lines are yours.</p>}

      {shown === "check-a" && (
      <>
      <p className="label">Check A: one answer for each line across your songs</p>
      {mine.length === 0 ? (
        <p className="record">
          No lines across your songs yet. <Go to="songs">Name a few songs</Go>
        </p>
      ) : (
        <ul className="plain stack">
          {mine.map((l) => (
            <LineToJudge
              key={l.id}
              line={l}
              options={CHECK_A}
              value={answerOf(st, "check_a_answered", l.id, ME, ME)}
              onPick={(v) => actions.judge({ kind: "check_a_answered", question_id: l.id, person_id: ME, judge_id: ME, value: v, line_text: l.pattern })}
            />
          ))}
        </ul>
      )}
      {answeredA.length > 0 && (
        <div className="card stack">
          <p className="label">Your answers so far ({answeredA.length} of {mine.length} lines)</p>
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
      <p className="label">The swap test: lines from two people&#39;s songs, mixed</p>
      {!other ? (
        <p className="record">
          The swap test needs a second person with three or more songs. On the songs page, use “Add someone else&#39;s songs”.
        </p>
      ) : (
        <>
          {people.length > 1 && (
            <div className="chip-row" role="group" aria-label="Mixed with">
              {people.map((p) => (
                <button key={p.person_id} type="button" className="act act-button" aria-pressed={other.person_id === p.person_id} onClick={() => setOtherId(p.person_id)}>
                  With {p.label}
                </button>
              ))}
            </div>
          )}
          <div className="chip-row" role="group" aria-label="Who is answering">
            <span className="label">Who is answering?</span>
            <button type="button" className="act act-button" aria-pressed={judge === ME} onClick={() => setJudge(ME)}>
              Me
            </button>
            <button type="button" className="act act-button" aria-pressed={judge === other.person_id} onClick={() => setJudge(other.person_id)}>
              {other.label}
            </button>
          </div>
          <p className="record">Whose songs each line comes from is hidden. For each line: is it yours?</p>
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
              <p className="label">The swap test, answered by {judgeLabel}</p>
              <p className="record">
                Lines from {judge === ME ? "your" : `${judgeLabel}'s`} songs marked Mine: {result.own.mine} of {result.own.of}. It passes when at least half are.
              </p>
              <p className="record">
                Lines from {otherLabel === "you" ? "your" : `${otherLabel}'s`} songs marked Mine: {result.other.mine} of {result.other.of}. It passes when one or none are.
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
