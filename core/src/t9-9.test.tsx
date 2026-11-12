// @vitest-environment happy-dom
/**
 * T9.9 The reading (FR-T9.9, with the Amendment of 2026-11-11). The network is a stand-in; no real key
 * is ever here. Checked: the address, the header, the key absent from the export and the usage log,
 * "Remove key" and "Erase everything" delete it, each plain-words error, the notice's words, what is
 * sent and only that, one retry, the cards, the verdicts, the counts, and the taste note.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { exportRecord } from "./numbers";
import { acceptedGuesses, assembleNote } from "./note";
import { makeReading, ping, plainError } from "./reading/call";
import { aboutCents, estimateCents, MODEL_ID, MODEL_NAME, PRICE_PER_MILLION } from "./reading/constants";
import { MIN_RECORDS, sentFor } from "./reading/facts";
import { readingPrompt, RULES } from "./reading/prompt";
import { deleteConnection, eraseAll, loadAll, loadConnection, openDb, putConnection, saveAll } from "./storage";
import { SHIPPING } from "./library";
import { apiError, GOOD_A, messageReply, PERSON_A, PERSON_C, STAND_IN_KEY, standIn } from "./testing/reading";
import { REFUSED, Reading, sendNotice, TEST_NOTICE, WHERE_KEY } from "../ui/Reading";
import { actions, getState, savedKey, seedForTests, toSnapshot } from "../ui/store";

const here = dirname(fileURLToPath(import.meta.url));
const SENT_A = sentFor(PERSON_A.songs, PERSON_A.words, { mayQuote: () => true });
const facts = Object.fromEntries(PERSON_A.songs.map((s) => [s.facts.recording_id, s.facts]));
const ok = (text: string) => ({ status: 200, body: messageReply(text) });

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
async function draw(node: React.ReactNode) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(node));
  return host;
}
afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  host = root = null;
});
const button = (h: HTMLElement, text: string) => [...h.querySelectorAll("button")].find((b) => b.textContent?.trim() === text)!;
const click = async (b: HTMLElement) => act(async () => b.click());

describe("the model, the price and the date are written in one constants file", () => {
  it("names Claude Sonnet 5.5 at $2 in and $10 out per million tokens, read on 2026-11-12", () => {
    expect([MODEL_ID, MODEL_NAME]).toEqual(["claude-sonnet-5-5", "Claude Sonnet 5.5"]);
    expect(PRICE_PER_MILLION).toEqual({ input: 2, output: 10 });
    expect(readFileSync(join(here, "reading", "constants.ts"), "utf8")).toContain('LOOKED_UP = "2026-11-12"');
  });
  it("a reading of the usual size is about 1 cent at that price", () => {
    expect(aboutCents(estimateCents(readingPrompt(SENT_A).length))).toBe("About 1 cent");
    expect(aboutCents(2.4)).toBe("About 2 cents");
  });
});

describe("the call: Anthropic's address, the browser header, the key, and nothing else", () => {
  it("'Test the connection' sends the one word ping to api.anthropic.com, with the header and the key", async () => {
    const { fetchFn, seen } = standIn([ok("pong")]);
    expect(await ping(STAND_IN_KEY, fetchFn)).toEqual({ ok: true, sentence: "Connected to Claude Sonnet 5.5." });
    expect(seen).toHaveLength(1);
    expect(new URL(seen[0]!.url).host).toBe("api.anthropic.com");
    expect(seen[0]!.headers.get("anthropic-dangerous-direct-browser-access")).toBe("true");
    // This version of Anthropic's library sends the key as a bearer token; either header carries the key and nothing else.
    expect(seen[0]!.headers.get("authorization") === `Bearer ${STAND_IN_KEY}` || seen[0]!.headers.get("x-api-key") === STAND_IN_KEY).toBe(true);
    expect(JSON.stringify(seen[0]!.body)).not.toContain(STAND_IN_KEY);
    expect(seen[0]!.body).toMatchObject({ model: MODEL_ID, messages: [{ role: "user", content: "ping" }] });
  });
  it("each failure is said in plain words", async () => {
    const cases: [Parameters<typeof standIn>[0][0], RegExp][] = [
      [apiError(401, "authentication_error", "invalid x-api-key"), /^The key is wrong\./],
      [apiError(400, "invalid_request_error", "Your credit balance is too low to access the Anthropic API."), /^The account has no credit\./],
      [apiError(402, "billing_error", "billing"), /^The account has no credit\./],
      [apiError(429, "rate_limit_error", "rate limited"), /^A limit was reached\./],
      [apiError(529, "overloaded_error", "overloaded"), /^Anthropic is busy\./],
      [new TypeError("Failed to fetch"), /^The page could not reach Anthropic\./],
    ];
    for (const [reply, words] of cases) {
      const r = await ping(STAND_IN_KEY, standIn([reply]).fetchFn);
      expect(r.ok).toBe(false);
      expect(r.sentence).toMatch(words);
      expect(r.sentence).not.toContain(STAND_IN_KEY);
    }
    expect(plainError(new Error("anything"))).toBe("Anthropic did not accept the call. Nothing was shown.");
  });
  it("a reading sends the prompt alone, asks for JSON, and sets no temperature (this model refuses one)", async () => {
    const { fetchFn, seen } = standIn([ok(JSON.stringify(GOOD_A))]);
    const r = await makeReading(STAND_IN_KEY, SENT_A, fetchFn);
    expect(r.status).toBe("made");
    expect(seen[0]!.body.messages).toEqual([{ role: "user", content: readingPrompt(SENT_A) }]);
    expect(seen[0]!.body).toMatchObject({ model: MODEL_ID, output_config: { format: { type: "json_schema" } }, thinking: { type: "between_tools" } });
    expect(seen[0]!.body).not.toHaveProperty("temperature");
  });
  it("one retry: a refused answer is followed by one more call on the same tap; a second refusal ends it", async () => {
    const bad = ok(JSON.stringify({ guesses: [{ ...GOOD_A.guesses[0]!, library_id: "LIB-8" }] }));
    const twice = standIn([bad, ok(JSON.stringify(GOOD_A))]);
    expect(await makeReading(STAND_IN_KEY, SENT_A, twice.fetchFn)).toMatchObject({ status: "made", attempts: 2 });
    const never = standIn([bad, bad, ok(JSON.stringify(GOOD_A))]);
    expect(await makeReading(STAND_IN_KEY, SENT_A, never.fetchFn)).toMatchObject({ status: "refused", attempts: 2 });
    expect(never.seen).toHaveLength(2);
    const declined = standIn([{ status: 200, body: messageReply("", "refusal") }, bad]);
    expect(await makeReading(STAND_IN_KEY, SENT_A, declined.fetchFn)).toMatchObject({ status: "refused", attempts: 2 });
  });
  it("the library repeats nothing by itself: a limit or a busy reply is one call, not three", async () => {
    for (const reply of [apiError(429, "rate_limit_error", "x"), apiError(529, "overloaded_error", "x")]) {
      const s = standIn([reply, ok("pong")]);
      expect((await ping(STAND_IN_KEY, s.fetchFn)).ok).toBe(false);
      expect(s.seen).toHaveLength(1);
    }
  });
  it("a failed call (the key, the credit) is not retried and costs nothing more", async () => {
    const s = standIn([apiError(401, "authentication_error", "x")]);
    expect(await makeReading(STAND_IN_KEY, SENT_A, s.fetchFn)).toMatchObject({ status: "failed", sentence: expect.stringMatching(/^The key is wrong/) });
    expect(s.seen).toHaveLength(1);
  });
});

describe("what is sent: his answers, the records' names, the facts code computed, and nothing else", () => {
  it("the prompt keeps the rules, gives the shipping library only, and holds no other words of his", () => {
    const p = readingPrompt(SENT_A);
    expect(p).toContain(RULES);
    for (const e of SHIPPING) expect(p).toContain(`- ${e.id}.`);
    for (const id of ["LIB-4", "LIB-8", "LIB-11"]) expect(p).not.toContain(`- ${id}.`);
    for (const w of PERSON_A.words) expect(p).toContain(w.text);
    // No answer is built into the prompt itself: with nothing sent, it holds no answer block at all.
    expect(readingPrompt({ records: [], facts: [] })).not.toContain("<<<");
    expect(p.split("<<<").length - 1).toBe(PERSON_A.words.length);
  });
  it("the facts are code's: the release year, the range and year he gave, what he comes back for", () => {
    expect(SENT_A.facts.map((f) => f.text)).toEqual([
      '"Glass Harbour" is a song by Juniper Varga, first released in 2020.',
      "The listener says it found them longer ago, about 2021.",
      '"Second Lamp" is a song by The Quiet Lanterns, first released in 2021.',
      "The listener comes back to it for the chorus.",
    ]);
    const withYear = sentFor(PERSON_A.songs, PERSON_A.words, { mayQuote: () => true, birthYear: 2000 });
    expect(withYear.facts.map((f) => f.text)).toContain("The listener was about 21 years old then.");
  });
  it("with a listening history, the facts add first play, plays, months, and a return after six months; the plays are never sent", () => {
    const row = (t: string, i: number) => ({ history_id: `h${i}`, person_id: "me", ended_at_utc: `${t}T20:00:00Z`, local_time: `${t}T20:00:00`, country: "GB", track_uri: "spotify:track:x", track: "Glass Harbour", artist: "Juniper Varga", album: "x", ms_played: 200_000 });
    const history = ["2021-01-05", "2021-01-20", "2021-02-03", "2022-03-01"].map(row);
    const s = sentFor(PERSON_A.songs, PERSON_A.words, { mayQuote: () => true, history });
    const texts = s.facts.filter((f) => f.record_id === "R1").map((f) => f.text);
    expect(texts).toEqual(expect.arrayContaining([
      "In the listener's listening history, the first play of it was in January 2021.",
      "The listening history has 4 plays of it.",
      "It was played in 3 different months.",
      "The listener came back to it in March 2022, after more than six months without a play.",
    ]));
    expect(readingPrompt(s)).not.toContain("spotify:track");
  });
  it("without his say-so, an answer that mentions a hard subject is not sent", () => {
    const hard = [{ ...PERSON_A.words[0]!, text: "It came the year I was in therapy." }, PERSON_A.words[1]!];
    const no = sentFor(PERSON_A.songs, hard, { mayQuote: (t) => !/therapy/.test(t) });
    expect(no.records.map((r) => r.title)).toEqual(["Second Lamp"]);
    expect(readingPrompt(no)).not.toContain("therapy");
    expect(no.records.length < MIN_RECORDS).toBe(true);
  });
});

describe("the key: kept in this browser only, never exported, never logged", () => {
  it("D16 is its own store: a snapshot saved and loaded never holds it, and erase deletes it", async () => {
    const factory = new IDBFactory();
    const db = await openDb(factory);
    await putConnection(db, { provider: "anthropic", key: STAND_IN_KEY, saved_at: "2026-11-12T10:00:00Z" });
    seedForTests({ songs: PERSON_A.songs.map((s) => s.entry), facts, words: PERSON_A.words });
    await saveAll(db, toSnapshot(getState()));
    expect(JSON.stringify(await loadAll(db))).not.toContain(STAND_IN_KEY);
    expect((await loadConnection(db))?.key).toBe(STAND_IN_KEY);
    await eraseAll(db, "2026-11-12T11:00:00Z");
    expect(await loadConnection(db)).toBeNull();
    await putConnection(db, { provider: "anthropic", key: STAND_IN_KEY, saved_at: "x" });
    await deleteConnection(db);
    expect(await loadConnection(db)).toBeNull();
  });
  it("the export file and the usage log never hold it, and the screen shows its last four characters only", async () => {
    seedForTests({ songs: PERSON_A.songs.map((s) => s.entry), facts, words: PERSON_A.words, quote_hard: false }, STAND_IN_KEY);
    await actions.tested(true, "Connected to Claude Sonnet 5.5.");
    const st = getState();
    const file = JSON.stringify(exportRecord({ snapshot: toSnapshot(st), plays: [], keys: [], nexts: [], histories: {} }, true, "2026-11-12T12:00:00Z"));
    expect(file).not.toContain(STAND_IN_KEY);
    expect(JSON.stringify(st.events)).not.toContain(STAND_IN_KEY);
    expect(JSON.stringify(st)).not.toContain(STAND_IN_KEY);
    expect(st.events.at(-1)).toMatchObject({ kind: "connection_tested", value: "connected" });
    const h = await draw(<Reading ready />);
    expect(h.textContent).toContain("A key ending in “wxyz” is saved in this browser only.");
    expect(h.innerHTML).not.toContain(STAND_IN_KEY);
  });
  it("'Remove key' and 'Erase everything' delete it", async () => {
    seedForTests({}, STAND_IN_KEY);
    expect(await savedKey()).toBe(STAND_IN_KEY);
    await actions.removeApiKey();
    expect(await savedKey()).toBeNull();
    expect(getState().connection).toBeUndefined();
    seedForTests({}, STAND_IN_KEY);
    await actions.eraseEverything();
    expect(await savedKey()).toBeNull();
  });
  it("the key field is hidden as a password field is, with 'Where do I get one?'", async () => {
    seedForTests({});
    const h = await draw(<Reading ready />);
    expect(h.textContent).toContain("Connect Claude with your own API key.");
    expect(h.querySelector("#api-key")?.getAttribute("type")).toBe("password");
    await click(button(h, "Where do I get one?"));
    expect(h.textContent).toContain(WHERE_KEY);
  });
  it("before 'Test the connection', the card says what it sends and what it costs", async () => {
    seedForTests({}, STAND_IN_KEY);
    const h = await draw(<Reading ready fetchFn={standIn([ok("pong")]).fetchFn} />);
    expect(h.textContent).toContain(TEST_NOTICE);
    await click(button(h, "Test the connection"));
    await vi.waitFor(() => expect(h.textContent).toContain("Connected to Claude Sonnet 5.5."));
  });
});

describe("the screen", () => {
  const seed = () => seedForTests({ songs: PERSON_A.songs.map((s) => s.entry), facts, words: PERSON_A.words, quote_hard: false }, STAND_IN_KEY);

  it("the notice before each send, in the amendment's words, with N and K filled in by code", async () => {
    expect(sendNotice(2, 4, 1.1)).toBe(
      "This sends your written answers about 2 records, their names, and 4 facts about them to Anthropic's Claude Sonnet 5.5, with your own API key. It goes to nobody else, and nothing else is sent. About 1 cent. If the answer fails my checks I try once more, for about another cent, and then stop; a reading that fails both times shows nothing and the cost is still spent.",
    );
    seed();
    const h = await draw(<Reading ready />);
    expect(h.textContent).toContain(sendNotice(2, 4, estimateCents(readingPrompt(SENT_A).length)));
    expect(button(h, "Send and make a reading").className).toBe("act-fill");
    expect(button(h, "Not now")).toBeTruthy();
    await click(button(h, "Not now"));
    expect(h.textContent).not.toContain("This sends your written answers");
  });
  it("asks once whether the reading may quote hard subjects, before anything is sent", async () => {
    seedForTests({ songs: PERSON_A.songs.map((s) => s.entry), facts, words: PERSON_A.words }, STAND_IN_KEY);
    const h = await draw(<Reading ready />);
    expect(h.textContent).toContain("My answers may mention a loss or a hard time. Let the reading quote them.");
    expect(h.textContent).not.toContain("This sends your written answers");
    await click(button(h, "No"));
    expect(getState().quote_hard).toBe(false);
    expect(h.textContent).toContain("This sends your written answers");
  });
  it("needs words about at least two records", async () => {
    seedForTests({ songs: PERSON_A.songs.map((s) => s.entry), facts, words: PERSON_A.words.slice(0, 1), quote_hard: true }, STAND_IN_KEY);
    const h = await draw(<Reading ready />);
    expect(h.textContent).toContain("A reading needs your words about at least 2 records. You have written about 1 record so far.");
    expect(h.textContent).not.toContain("Send and make a reading");
  });
  it("a reading made: at most two cards, each with the question, his words, what it rests on, the verdicts, and the finding behind a tap", async () => {
    seed();
    const h = await draw(<Reading ready fetchFn={standIn([ok(JSON.stringify(GOOD_A))]).fetchFn} />);
    await click(button(h, "Send and make a reading"));
    await vi.waitFor(() => expect(h.textContent).toContain(GOOD_A.guesses[0]!.question));
    const card = [...h.querySelectorAll("article")].find((a) => a.textContent?.includes("A guess for you to judge"))!;
    expect(card.querySelector(".line")?.textContent).toBe(GOOD_A.guesses[0]!.question);
    expect(card.textContent).toContain("Your words:");
    expect(card.textContent).toContain("“I worked night shifts at a bakery in Leeds” · about Glass Harbour");
    expect(card.textContent).toContain("This guess rests on 2 records.");
    for (const v of ["Yes", "Partly: fix this", "Neither"]) expect(button(card, v)).toBeTruthy();
    expect(card.textContent).not.toContain("Among 80 people");
    await click(button(card, "The nearest published finding"));
    expect(card.textContent).toContain("Among 80 people");
    expect(h.textContent).toContain("You have accepted 0 of 1 guess so far.");
    const r = getState().readings[0]!;
    expect(r).toMatchObject({ person_id: "me", model: MODEL_ID });
    expect(r.sent_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(getState().events.filter((e) => e.kind === "reading_made")).toHaveLength(1);
  });
  it("'Yes' counts the guess accepted and puts it on the note; 'Partly: fix this' keeps his words in its place", async () => {
    seed();
    const h = await draw(<Reading ready fetchFn={standIn([ok(JSON.stringify({ guesses: [GOOD_A.guesses[0]!, { ...GOOD_A.guesses[0]!, library_id: "none" }] }))]).fetchFn} />);
    await click(button(h, "Send and make a reading"));
    await vi.waitFor(() => expect(h.querySelectorAll("article").length).toBeGreaterThan(2));
    const cards = [...h.querySelectorAll("article")].filter((a) => a.textContent?.includes("A guess for you to judge"));
    expect(cards).toHaveLength(2);
    await click(button(cards[0]!, "Yes"));
    expect(h.textContent).toContain("You have accepted 1 of 2 guesses so far.");
    await click(button(cards[1]!, "Partly: fix this"));
    const box = cards[1]!.querySelector("textarea")!;
    expect(box.value).toBe(GOOD_A.guesses[0]!.question);
    expect(box.getAttribute("spellcheck")).toBe("true");
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      set.call(box, "It was the walk home, not the bakery.");
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click(button(cards[1]!, "Keep my words"));
    const st = getState();
    expect(st.events.map((e) => e.kind)).toEqual(expect.arrayContaining(["guess_accepted", "guess_fixed"]));
    expect(JSON.stringify(st.events.filter((e) => e.kind.startsWith("guess_")))).not.toContain("walk home");
    const note = assembleNote(st.choices, st.words, [], "me", st.readings);
    expect(note.accepted.map((s) => [s.label, s.text])).toEqual([["A reading you accepted", GOOD_A.guesses[0]!.question]]);
    expect(note.own.find((w) => w.label === "Your words")?.text).toBe("It was the walk home, not the bakery.");
    expect(acceptedGuesses(st.readings).length).toBe(1);
  });
  it("a reading refused twice shows the fail line, stores nothing, and the log counts it", async () => {
    seed();
    const bad = ok("not json");
    const h = await draw(<Reading ready fetchFn={standIn([bad, bad]).fetchFn} />);
    await click(button(h, "Send and make a reading"));
    await vi.waitFor(() => expect(h.textContent).toContain(REFUSED));
    expect(REFUSED).toBe("No reading this time. Nothing was shown because a check failed.");
    expect(getState().readings).toHaveLength(0);
    expect(getState().events.filter((e) => e.kind === "reading_refused").map((e) => e.value)).toEqual(["once", "twice"]);
  });
  it("a reading with no guess says so in a whole sentence", async () => {
    seed();
    const h = await draw(<Reading ready fetchFn={standIn([ok('{"guesses": []}')]).fetchFn} />);
    await click(button(h, "Send and make a reading"));
    await vi.waitFor(() => expect(h.textContent).toContain("The reading found no link in your words that it could support, so it makes no guess."));
  });
  it("a stored reading is shown unchanged on a later visit, and 'Make a new reading' shows the notice again", async () => {
    seed();
    const first = await draw(<Reading ready fetchFn={standIn([ok(JSON.stringify(GOOD_A))]).fetchFn} />);
    await click(button(first, "Send and make a reading"));
    await vi.waitFor(() => expect(first.textContent).toContain(GOOD_A.guesses[0]!.question));
    act(() => root!.unmount());
    const later = await draw(<Reading ready />);
    expect(later.textContent).toContain(GOOD_A.guesses[0]!.question);
    expect(later.textContent).not.toContain("This sends your written answers");
    await click(button(later, "Make a new reading"));
    expect(later.textContent).toContain("This sends your written answers");
  });
  it("a Chinese answer is sent and quoted as he wrote it", () => {
    const c = sentFor(PERSON_C.songs, PERSON_C.words, { mayQuote: () => true });
    expect(readingPrompt(c)).toContain(PERSON_C.words[0]!.text);
  });
});

describe("the footer on every screen says what leaves", () => {
  it("names the reading as the one exception, and passes the register check", async () => {
    const { PRIVACY_LINE } = await import("../ui/Footer");
    const { passes } = await import("./checks");
    expect(PRIVACY_LINE).toContain("a reading you ask for, which sends your written answers to Anthropic");
    expect(passes(PRIVACY_LINE, "fact")).toBe(true);
  });
});

describe("the site's content security policy", () => {
  it("lets the page talk only to this site, the data sources, and api.anthropic.com, and load no script from elsewhere", () => {
    const v = JSON.parse(readFileSync(join(here, "..", "..", "vercel.json"), "utf8")) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
    const csp = v.headers.flatMap((h) => h.headers).find((h) => h.key === "Content-Security-Policy")!.value;
    const dir = (name: string) => csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `))!.split(/\s+/).slice(1);
    expect(dir("connect-src").sort()).toEqual(["'self'", "https://acousticbrainz.org", "https://api.anthropic.com", "https://musicbrainz.org", "https://www.wikidata.org"].sort());
    expect(dir("script-src").every((s) => s.startsWith("'"))).toBe(true);
    expect(dir("default-src")).toEqual(["'self'"]);
  });
});
