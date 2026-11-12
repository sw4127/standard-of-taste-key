/**
 * Made-up people for the reading's tests and the gate's fresh runs (FR-T9.10). Every person, answer,
 * record and artist here is fictional and labelled as an example; none is Bob's or his friend's.
 * The records are the example catalogue's made-up songs.
 */
import { EXAMPLE_CATALOGUE } from "../examples";
import type { NamedSong, Song } from "../model";
import type { Words } from "../note";
import type { Guess } from "../reading/check";
import type { FetchLike } from "../reading/call";
import { MODEL_ID } from "../reading/constants";

/** A key-shaped string that opens nothing: the tests' stand-in. Never a real key. */
export const STAND_IN_KEY = "sk-ant-example-standin-0000-NOTAKEY-wxyz";

const entry = (entry_id: string, f: (typeof EXAMPLE_CATALOGUE)[number], over: Partial<NamedSong> = {}): NamedSong => ({
  entry_id, person_id: "me", typed_text: f.title, recording_id: f.recording_id, comes_back_for: "unanswered", found_me: "unanswered", entered_at: "2026-11-12T09:00:00Z", ...over,
});
const words = (about: string, text: string, i: number): Words => ({ words_id: `w-${about}`, person_id: "me", question: "When and where did it come into your life?", about, text, written_at: `2026-11-12T10:0${i}:00Z`, in_note: true });

export interface ExamplePerson {
  id: "a" | "b" | "c";
  label: string;
  songs: Song[];
  words: Words[];
}

const [GLASS, LAMP, KITE] = [EXAMPLE_CATALOGUE[0]!, EXAMPLE_CATALOGUE[1]!, EXAMPLE_CATALOGUE[2]!];

/** (a) Two answers that share a link: the same winter of night shifts. */
export const PERSON_A: ExamplePerson = {
  id: "a",
  label: "Example person A (made up): two answers that share a link",
  songs: [
    { entry: entry("a1", GLASS, { found_me: "longer ago", found_year: 2021 }), facts: GLASS },
    { entry: entry("a2", LAMP, { comes_back_for: "the chorus" }), facts: LAMP },
  ],
  words: [
    words("a1", "Glass Harbour came into my life in the winter of 2021, when I worked night shifts at a bakery in Leeds. I played it on the walk home at five in the morning, when the streets were empty. It made me slow down on that walk instead of rushing to bed.", 1),
    words("a2", "A friend at the bakery put Second Lamp on the radio during a night shift that same winter. My days then were upside down: sleep until two, flour on everything. That song kept me company until the ovens were done.", 2),
  ],
};

/** (b) Records with no story: the right answer is none. */
export const PERSON_B: ExamplePerson = {
  id: "b",
  label: "Example person B (made up): records with no story",
  songs: [
    { entry: entry("b1", GLASS), facts: GLASS },
    { entry: entry("b2", KITE), facts: KITE },
  ],
  words: [words("b1", "It was on the radio. I don't remember when.", 1), words("b2", "I think I heard it in a shop once. Nothing special.", 2)],
};

/** (c) Answers in Chinese only. */
export const PERSON_C: ExamplePerson = {
  id: "c",
  label: "Example person C (made up): answers in Chinese only",
  songs: [
    { entry: entry("c1", GLASS, { found_me: "longer ago", found_year: 2021 }), facts: GLASS },
    { entry: entry("c2", LAMP), facts: LAMP },
  ],
  words: [
    words("c1", "2021年夏天，我刚搬到成都，每天骑车去实习的公司。路上耳机里总是放这首歌。它让我在堵车的时候也不着急。", 1),
    words("c2", "也是那个夏天，室友晚上在阳台上放这首歌。那时候每天加班到很晚，回家听到它就知道一天结束了。", 2),
  ],
};

export const PEOPLE = [PERSON_A, PERSON_B, PERSON_C];

/** A well-formed output for person A: it must pass every check. */
export const GOOD_A: { guesses: Guess[] } = {
  guesses: [
    {
      question: "Both records arrived in the same winter of night shifts at the bakery. Is the walk home at five in the morning part of what these two records are for you?",
      quotes: [
        { record_id: "R1", quote: "I worked night shifts at a bakery in Leeds" },
        { record_id: "R2", quote: "put Second Lamp on the radio during a night shift that same winter" },
      ],
      what_it_did: [{ record_id: "R1", quote: "It made me slow down on that walk instead of rushing to bed." }],
      fact_ids: [],
      library_id: "LIB-2",
      rests_on: 2,
    },
  ],
};

/** A reply from the Messages API, as the stand-in returns it. */
export const messageReply = (text: string, stop_reason = "end_turn") => ({
  id: "msg_standin", type: "message", role: "assistant", model: MODEL_ID, content: [{ type: "text", text }], stop_reason, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 },
});

export interface Seen {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

/** A stand-in for the network: records each call and answers with the next reply in the list. */
export function standIn(replies: ({ status: number; body: unknown } | Error)[]): { fetchFn: FetchLike; seen: Seen[] } {
  const seen: Seen[] = [];
  let i = 0;
  const fetchFn: FetchLike = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    seen.push({ url, headers: new Headers(init?.headers as HeadersInit), body: JSON.parse(String(init?.body ?? "{}")) });
    const r = replies[Math.min(i++, replies.length - 1)]!;
    if (r instanceof Error) throw r;
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json", "request-id": "req_standin" } });
  };
  return { fetchFn, seen };
}

export const apiError = (status: number, type: string, message: string) => ({ status, body: { type: "error", error: { type, message }, request_id: "req_standin" } });
