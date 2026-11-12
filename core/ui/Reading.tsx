"use client";
/**
 * The reading (FR-T9.9, with the Amendment of 2026-11-11), at /reading on the website. In order:
 * connect Claude with his own API key (kept in this browser only; "Test the connection"); the one
 * choice on quoting hard subjects; what is needed (his words about at least two records); the notice
 * before each send, with "Send and make a reading" and "Not now"; the guesses, at most two cards; the
 * count of guesses accepted; "Make a new reading". If the gate (FR-T9.10) has not passed, the page
 * says "The reading is not ready yet." and nothing else of FR-T9.9.
 */
import { useEffect, useMemo, useState } from "react";
import { passes } from "../src/checks";
import { shipping } from "../src/library";
import { aboutCents, estimateCents, MODEL_ID, MODEL_NAME } from "../src/reading/constants";
import { hashOf, makeReading, ping, type FetchLike } from "../src/reading/call";
import { MIN_RECORDS, sentFor } from "../src/reading/facts";
import { NOT_READY, readingReady } from "../src/reading/gate";
import { readingPrompt } from "../src/reading/prompt";
import { accepted, guessRows, questionsFile, type GuessRow, type ReadingRow } from "../src/reading/rows";
import { SITE } from "../src/site";
import { Go, SourceRef } from "./nav";
import { actions, hydrate, ME, savedKey, songsOf, useStore } from "./store";

export const REFUSED = "No reading this time. Nothing was shown because a check failed.";
export const TEST_NOTICE = "This sends one word to Anthropic and costs a small fraction of a cent.";
export const WHERE_KEY = "The key comes from your own Anthropic account. Make one for this site only, in a workspace with a spend limit, so that it can be deleted or capped without touching anything else.";
export const QUOTE_HARD = "My answers may mention a loss or a hard time. Let the reading quote them.";
export const NO_GUESS = "The reading found no link in your words that it could support, so it makes no guess.";

/** The notice before each send (Amendment of 2026-11-11), with N, K and the cost filled in by code. */
export function sendNotice(n: number, k: number, cents: number): string {
  const about = aboutCents(cents);
  const again = about === "About 1 cent" ? "about another cent" : `about another ${about.slice(6)}`;
  return `This sends your written answers about ${n} records, their names, and ${k} ${k === 1 ? "fact" : "facts"} about them to Anthropic's ${MODEL_NAME}, with your own API key. It goes to nobody else, and nothing else is sent. ${about}. If the answer fails my checks I try once more, for ${again}, and then stop; a reading that fails both times shows nothing and the cost is still spent.`;
}

const id = () => Math.random().toString(36).slice(2, 10);
const recordsWord = (n: number) => (n === 1 ? "record" : "records");

function Connect({ fetchFn }: { fetchFn?: FetchLike }) {
  const st = useStore();
  const [draft, setDraft] = useState("");
  const [where, setWhere] = useState(false);
  const [testing, setTesting] = useState(false);
  const c = st.connection;
  return (
    <article className="card stack" aria-label="Your model account">
      <p className="label">Connect Claude with your own API key.</p>
      <p className="record">An API key is a long password that lets a program use a paid account. The reading is paid by you, to Anthropic, through your own account.</p>
      {!c ? (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) void actions.saveApiKey(draft).then(() => setDraft(""));
          }}
        >
          <label className="label" htmlFor="api-key">
            Your API key
          </label>
          <input id="api-key" className="field" type="password" autoComplete="off" spellCheck={false} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="row">
            <button type="submit" className="act" disabled={!draft.trim()}>
              Save the key
            </button>
            <button type="button" className="act" aria-expanded={where} onClick={() => setWhere((w) => !w)}>
              Where do I get one?
            </button>
          </div>
          {where && <p className="record">{WHERE_KEY}</p>}
          <p className="meta">The key is kept in this browser only. It is never in the export file, and it is sent nowhere but api.anthropic.com.</p>
        </form>
      ) : (
        <>
          <p className="record">A key ending in “{c.key_last4}” is saved in this browser only.</p>
          <p className="meta">{TEST_NOTICE}</p>
          <div className="row">
            <button
              type="button"
              className="act"
              disabled={testing}
              onClick={async () => {
                setTesting(true);
                const key = await savedKey();
                const r = key ? await ping(key, fetchFn) : { ok: false, sentence: "No key is saved in this browser." };
                await actions.tested(r.ok, r.sentence);
                setTesting(false);
              }}
            >
              {testing ? "Testing…" : "Test the connection"}
            </button>
            <button type="button" className="act" onClick={() => void actions.removeApiKey()}>
              Remove key
            </button>
          </div>
          {c.last_test && (
            <p className="record" role="status">
              {c.last_test.sentence}
            </p>
          )}
        </>
      )}
    </article>
  );
}

function QuoteChoice() {
  const st = useStore();
  return (
    <article className="card stack" aria-label="Quoting hard subjects">
      <p className="voice">{QUOTE_HARD}</p>
      <div className="chip-row">
        <button type="button" className="act choice" aria-pressed={st.quote_hard === true} onClick={() => actions.setQuoteHard(true)}>
          Yes, it may quote them
        </button>
        <button type="button" className="act choice" aria-pressed={st.quote_hard === false} onClick={() => actions.setQuoteHard(false)}>
          No
        </button>
      </div>
      <p className="meta">You can change this here at any time. If you say no, an answer that mentions a loss or a hard time is not sent.</p>
    </article>
  );
}

function GuessCard({ reading, g }: { reading: ReadingRow; g: GuessRow }) {
  const st = useStore();
  const fix = st.words.find((w) => w.about === g.guess_id && w.person_id === ME);
  const [fixing, setFixing] = useState(false);
  const [draft, setDraft] = useState(fix?.text ?? g.question);
  const [finding, setFinding] = useState(false);
  const lib = g.library_id !== "none" ? shipping(g.library_id) : null;
  return (
    <article className="card stack">
      <p className="label">A guess for you to judge</p>
      <p className="line">{g.question}</p>
      <p className="label">Your words:</p>
      <ul className="plain stack">
        {[...g.quotes, ...g.what_it_did.filter((w) => !g.quotes.some((q) => q.quote === w.quote))].map((q, i) => (
          <li key={i}>
            <span className="own">“{q.quote}”</span> <span className="meta">· about {q.title}</span>
          </li>
        ))}
      </ul>
      <p className="meta">This guess rests on {g.rests_on} {recordsWord(g.rests_on)}.</p>
      <div className="chip-row" role="group" aria-label="Your verdict">
        <button type="button" className="act choice" aria-pressed={g.verdict === "yes"} onClick={() => { setFixing(false); actions.verdict(reading.reading_id, g.guess_id, "yes"); }}>
          Yes
        </button>
        <button type="button" className="act choice" aria-pressed={g.verdict === "partly"} onClick={() => setFixing(true)}>
          Partly: fix this
        </button>
        <button type="button" className="act choice" aria-pressed={g.verdict === "neither"} onClick={() => { setFixing(false); actions.verdict(reading.reading_id, g.guess_id, "neither"); }}>
          Neither
        </button>
      </div>
      {(fixing || (g.verdict === "partly" && fix)) && (
        <div className="stack">
          <label className="label" htmlFor={`fix-${g.guess_id}`}>
            In your words
          </label>
          <textarea id={`fix-${g.guess_id}`} className="own words-box" rows={3} spellCheck value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button
            type="button"
            className="act choice"
            disabled={!draft.trim()}
            onClick={() => {
              actions.verdict(reading.reading_id, g.guess_id, "partly", { question: g.question, text: draft.trim() });
              setFixing(false);
            }}
          >
            {fix && fix.text === draft.trim() ? "Kept as your words" : "Keep my words"}
          </button>
        </div>
      )}
      {lib && (
        <>
          <button type="button" className="act" aria-expanded={finding} onClick={() => setFinding((f) => !f)}>
            The nearest published finding
          </button>
          {finding && (
            <div className="evidence stack">
              <p className="record">{lib.sentence}</p>
              <p className="meta">
                <SourceRef source={{ label: lib.citation, url: lib.url }} />
              </p>
            </div>
          )}
        </>
      )}
    </article>
  );
}

function ReadingCards({ r }: { r: ReadingRow }) {
  if (!r.guesses.length) return <p className="card record">{NO_GUESS}</p>;
  return (
    <>
      {r.guesses.map((g) => (
        <GuessCard key={g.guess_id} reading={r} g={g} />
      ))}
    </>
  );
}

/**
 * In the panel (FR-T9.9: "The panel links to it"). The panel never holds the key, and it cannot read
 * what the website keeps (each keeps its own rows in its own part of the browser), so it links.
 */
export function ReadingLink() {
  return (
    <article className="card stack">
      <p className="record">A reading of your words is made on the website, where your API key stays in your browser. It uses the records and words you wrote about on the website.</p>
      <a className="act" href={`${SITE}/reading/`} target="_blank" rel="noreferrer">
        Open the reading on the website
      </a>
    </article>
  );
}

type Phase = { at: "idle" } | { at: "later" } | { at: "notice" } | { at: "sending" } | { at: "refused" } | { at: "failed"; sentence: string };

export function Reading({ fetchFn, ready = readingReady() }: { fetchFn?: FetchLike; ready?: boolean }) {
  const st = useStore();
  useEffect(() => void hydrate(), []);
  const mine = st.readings.filter((r) => r.person_id === ME);
  const [phase, setPhase] = useState<Phase>({ at: "idle" });
  const [earlier, setEarlier] = useState(false);
  const songs = useMemo(() => songsOf(st, ME), [st]);
  const sent = useMemo(
    () => sentFor(songs, st.words, { birthYear: st.birth_year, history: st.histories[ME], mayQuote: (t) => st.quote_hard === true || passes(t, "words") }),
    [songs, st.words, st.birth_year, st.histories, st.quote_hard],
  );
  const heldBack = useMemo(
    () => sentFor(songs, st.words, { mayQuote: () => true }).records.length - sent.records.length,
    [songs, st.words, sent],
  );

  if (!st.ready) return <p className="card meta" role="status">Reading what this browser keeps…</p>;
  if (!ready) {
    return (
      <section className="stack-lg">
        <p className="card line">{NOT_READY}</p>
      </section>
    );
  }

  const prompt = readingPrompt(sent);
  const enough = sent.records.length >= MIN_RECORDS;
  const latest = mine[mine.length - 1];
  const showNotice = st.connection && st.quote_hard !== undefined && enough && (phase.at === "notice" || (phase.at === "idle" && !latest));
  const { a, b } = accepted(st.readings);

  const send = async () => {
    setPhase({ at: "sending" });
    const key = await savedKey();
    if (!key) return setPhase({ at: "failed", sentence: "No key is saved in this browser." });
    const r = await makeReading(key, sent, fetchFn);
    if (r.status === "made") {
      actions.keepReading({ reading_id: id(), person_id: ME, made_at: new Date().toISOString(), model: MODEL_ID, sent_hash: await hashOf(prompt), guesses: guessRows(r.guesses, sent, id) }, r.attempts === 2);
      setPhase({ at: "idle" });
    } else if (r.status === "refused") {
      actions.readingRefused(r.attempts);
      setPhase({ at: "refused" });
    } else setPhase({ at: "failed", sentence: r.sentence });
  };

  const exportQuestions = () => {
    const at = new Date().toISOString();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(questionsFile(st.readings, at), null, 1)], { type: "application/json" }));
    a.download = `my-reading-questions-${at.slice(0, 10)}.json`;
    a.click();
    actions.log("export_made", { value: "reading questions" });
  };

  return (
    <section className="stack-lg">
      <div className="card stack">
        <p className="line">A reading of your words</p>
        <p className="record">A reading places your own words about two records side by side and asks you whether a link between them is true. You say yes, fix it, or say neither.</p>
      </div>

      <Connect fetchFn={fetchFn} />
      {st.connection && <QuoteChoice />}

      {st.connection && st.quote_hard !== undefined && !enough && (
        <div className="card stack">
          <p className="record">
            A reading needs your words about at least {MIN_RECORDS} records. You have written about {sent.records.length} {recordsWord(sent.records.length)} so far.
          </p>
          {heldBack > 0 && <p className="meta">{heldBack === 1 ? "One answer mentions a loss or a hard time, and you chose not to let the reading quote it." : `${heldBack} answers mention a loss or a hard time, and you chose not to let the reading quote them.`}</p>}
          <Go to="songs">Write about your records</Go>
        </div>
      )}

      {showNotice && (
        <article className="card stack" aria-label="Before you send">
          <p className="record">{sendNotice(sent.records.length, sent.facts.length, estimateCents(prompt.length))}</p>
          {heldBack > 0 && <p className="meta">{heldBack === 1 ? "One answer mentions a loss or a hard time and is not sent, as you chose." : `${heldBack} answers mention a loss or a hard time and are not sent, as you chose.`}</p>}
          <div className="row">
            <button type="button" className="act-fill" onClick={() => void send()}>
              Send and make a reading
            </button>
            <button type="button" className="act" onClick={() => setPhase({ at: "later" })}>
              Not now
            </button>
          </div>
        </article>
      )}
      {phase.at === "sending" && (
        <p className="card record" role="status">
          Sending your answers to Anthropic and checking what comes back…
        </p>
      )}
      {phase.at === "refused" && (
        <div className="card stack">
          <p className="record">{REFUSED}</p>
          <Go to="songs">Your lines across records</Go>
        </div>
      )}
      {phase.at === "failed" && <p className="card record">{phase.sentence}</p>}
      {!latest && st.connection && enough && (phase.at === "later" || phase.at === "refused" || phase.at === "failed") && (
        <div className="card slim">
          <button type="button" className="act" onClick={() => setPhase({ at: "notice" })}>
            Make a reading
          </button>
        </div>
      )}

      {latest && phase.at !== "sending" && <ReadingCards r={latest} />}

      {latest && (
        <div className="card stack">
          <p className="record">
            You have accepted {a} of {b} {b === 1 ? "guess" : "guesses"} so far.
          </p>
          {st.connection && enough && phase.at !== "notice" && phase.at !== "sending" && (
            <button type="button" className="act" onClick={() => setPhase({ at: "notice" })}>
              Make a new reading
            </button>
          )}
          {mine.length > 1 && (
            <button type="button" className="act" aria-expanded={earlier} onClick={() => setEarlier((e) => !e)}>
              {earlier ? "Hide earlier readings" : `Earlier readings (${mine.length - 1})`}
            </button>
          )}
        </div>
      )}
      {earlier && mine.slice(0, -1).reverse().map((r) => <ReadingCards key={r.reading_id} r={r} />)}

      {mine.some((r) => r.guesses.length) && (
        <div className="card stack">
          <p className="label">For a swap test with someone else</p>
          <p className="record">This file holds only the questions of your readings, with every quote, fact and record name taken out. Give it to the person whose sheet it is for.</p>
          <button type="button" className="act" onClick={exportQuestions}>
            Export my questions
          </button>
        </div>
      )}
    </section>
  );
}
