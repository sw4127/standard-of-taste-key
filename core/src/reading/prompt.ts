/**
 * FR-T9.9, what is sent for a reading: the prompt, his answers, the records' names and the facts code
 * computed for those records, and nothing else. The prompt keeps the nine rules of the tested text
 * (stage-9/reading-test-prompt-v2.md, made general: no person's answers are in it) and adds: at most
 * two guesses; each joins two different records, or his words with one of the facts; none when none
 * is supported; plain whole sentences. The library given is the shipping library (A4).
 */
import { SHIPPING, type LibraryEntry } from "../library";

/** One record he wrote about, as sent. `record_id` is "R1", "R2"…, used only inside one reading. */
export interface SentRecord {
  record_id: string;
  entry_id: string;
  title: string;
  artist: string;
  kind: "song" | "album";
  /** His "In your words" answer about this record, exactly as he wrote it. */
  answer: string;
}

/** One fact code computed about a record, as sent. `fact_id` is "F1", "F2"…. */
export interface SentFact {
  fact_id: string;
  record_id: string;
  text: string;
}

export interface Sent {
  records: SentRecord[];
  facts: SentFact[];
}

const libraryLine = (e: LibraryEntry) => `- ${e.id}. ${e.label ? `(${e.label}) ` : ""}${e.sentence} (${e.citation})`;

export const RULES = `1. Every claim about the listener must rest on exact quotes from their answers. A quote is a character-for-character part of one answer, copied with its original spelling, grammar and language. Never fix or translate inside a quote. Give each quote with the ID of the record whose answer it comes from.
2. Write no number that scores or rates the listener, and no percentage.
3. Never state a personality trait, a mood, a diagnosis or advice. Never say what the listener "is". Each link is a guess, phrased as a question.
4. If their answers mention a death, a loss, an illness or a painful decision, add no claim of your own about it. You may only quote and arrange what they said about it. Add no cause, no comfort and no advice.
5. Never describe what any record sounds like, says or means from your own knowledge. If a link needs what a record says, use only the listener's own description of it.
6. library_id must be one of the IDs in LIBRARY, or "none".
7. A link must be supported by quotes about two different records, or by a quote and one of the FACTS. If no link is supported, return an empty list of guesses. Do not force a link.
8. Write each question in plain English, in whole sentences, at most 45 words, addressed to the listener as "you". Count the words of each question before you answer: a question of more than 45 words is refused, so keep it well under. No fragments and no figures of speech.
9. Say that a record did something only where the listener's own sentence names the record, the song, the album or "it" as the thing that did it (for example a sentence beginning "It tells me" or "that song made me"). Anything else they know, believe or feel comes from their life, not from the record: never say or imply that the record gave it to them. Put the quote of each such sentence in what_it_did.
10. Every guess is about what a record did or when and where it came, never about how two events in the listener's life relate to each other. Never say that one event in their life caused, explained or led to another.
11. Give at most two guesses.`;

export const SHAPE = `{
  "guesses": [
    {
      "question": "the guess, as a question to the listener",
      "quotes": [{"record_id": "R1", "quote": "exact quote"}, {"record_id": "R2", "quote": "exact quote"}],
      "what_it_did": [{"record_id": "R1", "quote": "exact quote of a sentence that names the record as acting"}],
      "fact_ids": ["F1"],
      "library_id": "LIB-n or none",
      "rests_on": 2
    }
  ]
}`;

/** The JSON schema the answer must follow (structured outputs: every object closed, every field required). */
export const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["guesses"],
  properties: {
    guesses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "quotes", "what_it_did", "fact_ids", "library_id", "rests_on"],
        properties: {
          question: { type: "string" },
          quotes: { type: "array", items: { $ref: "#/$defs/quote" } },
          what_it_did: { type: "array", items: { $ref: "#/$defs/quote" } },
          fact_ids: { type: "array", items: { type: "string" } },
          library_id: { type: "string" },
          rests_on: { type: "integer" },
        },
      },
    },
  },
  $defs: {
    quote: {
      type: "object",
      additionalProperties: false,
      required: ["record_id", "quote"],
      properties: { record_id: { type: "string" }, quote: { type: "string" } },
    },
  },
} as const;

/** The whole text sent to the model for one reading. Nothing else is sent. */
export function readingPrompt(sent: Sent, library: readonly LibraryEntry[] = SHIPPING): string {
  const records = sent.records
    .map((r) => `### ${r.record_id}: "${r.title}" (${r.kind === "album" ? "an album" : "a song"} by ${r.artist})\nANSWER ${r.record_id}:\n<<<\n${r.answer}\n>>>`)
    .join("\n\n");
  const facts = sent.facts.length ? sent.facts.map((f) => `- ${f.fact_id} (${f.record_id}). ${f.text}`).join("\n") : "- none";
  return `You are the language model inside a music product. Read everything below, then return ONE JSON object in the shape given at the end, and nothing else.

## What the product is doing

A listener named some records and wrote, in their own words, when and where each came into their life and what their days looked like then. Code has already computed the facts below. Your job is narrow: quote the listener, look for at most two links that each join two different records (or the listener's words with one of the facts), pick the library finding that sits nearest each link, and phrase each link as a question they can accept, correct or reject.

## Rules (code checks every one it can; if any guess breaks one, the product shows nothing)

${RULES}

## RECORDS AND ANSWERS

${records}

## FACTS (computed by code; you may cite them by ID, never add to them)

${facts}

## LIBRARY (published findings; cite by ID)

${library.map(libraryLine).join("\n")}

## Output: exactly this JSON shape

${SHAPE}

If no link is supported, return {"guesses": []}.`;
}
