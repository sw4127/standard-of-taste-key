/**
 * D4 Line Templates (PRD section 4): hand-written sentence patterns with blanks, shipped read-only.
 * Code fills the blanks; no model writes, chooses or judges any of it (rule 1).
 *
 * Every reading offered on a line across songs (T9.3) cites a fact about music, its grounding source.
 * A part with no cited definition (the voice, the words) has no readings, so its line is not shown.
 */
import { shipping } from "./library";
import type { CreditRole, Part } from "./model";

export interface Grounding {
  citation: string;
  url: string;
  /** FR-T9.3 (f): a published finding is cited only from the shipping library, by its ID. */
  library_id?: string;
}

/** A shipping library entry as a reading's grounding; one that may not ship cannot be asked for. */
export function fromLibrary(id: string): Grounding {
  const e = shipping(id);
  return { citation: `${e.citation}: ${e.sentence}`, url: e.url, library_id: e.id };
}

export const LIB_2 = fromLibrary("LIB-2");
export const LIB_3 = fromLibrary("LIB-3");
export const LIB_9 = fromLibrary("LIB-9");

/*
 * The rework (2026-11-12, FR-T9.3 (f)): Gagnon & Peretz 2003 and Krumhansl & Zupnick 2013 are not in
 * the shipping library, so the key, tempo and date readings now cite LIB-9 and LIB-3. The glossary,
 * Wikipedia and MusicBrainz groundings below define a term; they state no finding, so they stay.
 */
export const SUNO_GLOSSARY: Grounding = {
  citation: "Music Glossary for Suno (bridge, verse, chorus, intro, groove, timbre)",
  url: "https://help.suno.com/en/articles/9010177",
};
export const WIKIPEDIA_KEY: Grounding = {
  citation: "Wikipedia, \"Key (music)\": a key's tonic is the pitch a piece is oriented around and almost always ends on",
  url: "https://en.wikipedia.org/wiki/Key_(music)",
};
/** Checked against the page on 2026-11-08: it lists who did what on a recording (producer, engineer, mixer…). */
export const MUSICBRAINZ_ROLES: Grounding = {
  citation: "MusicBrainz, artist–recording relationship types (who did what on a recording)",
  url: "https://musicbrainz.org/relationships/artist-recording",
};

export interface ReadingTemplate {
  template_id: string;
  /** The reading as offered: a question. */
  ask: string;
  /** The reading as the person kept it, for the taste note: "You said: …". */
  kept: string;
  grounding: Grounding;
  /** FR-T9.3 (b): the button's words when they are an answer to a question shown above ("Yes"). */
  answer?: string;
}

export interface KindTemplates {
  kind: PatternKind;
  readings: [ReadingTemplate, ReadingTemplate];
  /** T9.4: one optional question about memory and context. Never "why". */
  question: string;
}

export type PatternKind =
  | "key-major"
  | "key-shared"
  | "tempo"
  | `part:${Part}`
  | "release-window"
  | "found-later"
  | "shared-person"
  | "period";

const pair = (
  id: string,
  g: Grounding,
  a: [string, string],
  b: [string, string],
): [ReadingTemplate, ReadingTemplate] => [
  { template_id: `${id}/a`, ask: a[0], kept: a[1], grounding: g },
  { template_id: `${id}/b`, ask: b[0], kept: b[1], grounding: g },
];

const WHERE_FIRST = "Where were you when one of these first reached you?";

export const KIND_TEMPLATES: Record<string, KindTemplates> = {
  "key-major": {
    kind: "key-major",
    readings: pair("key-major", LIB_9,
      ["In one experiment, changing a piece from major to minor changed how listeners felt, and not how alert they were. Is the mood a major key gives part of what pulls you in?", "the mood a major key gives may be part of what pulls you in"],
      ["Or does the key make no difference to you in these songs?", "the key makes no difference to you in these songs"]),
    question: WHERE_FIRST,
  },
  "key-shared": {
    kind: "key-shared",
    readings: pair("key-shared", WIKIPEDIA_KEY,
      ["A key's home note is the one a song keeps returning to. Do you hear {key}'s home note in all of these?", "the home note these songs share may be part of what you hear in them"],
      ["Or do these songs sound unrelated to you?", "these songs sound unrelated to you"]),
    question: WHERE_FIRST,
  },
  tempo: {
    kind: "tempo",
    readings: pair("tempo", LIB_9,
      ["In one experiment, changing a piece's tempo changed how alert listeners felt, and not their mood. Is the pace these songs share part of what keeps you listening?", "the pace these songs share may be part of what keeps you listening"],
      ["Or do they sound like different speeds to you?", "these songs sound like different speeds to you"]),
    question: "What are you usually doing when you play these?",
  },
  "part:the bridge": {
    kind: "part:the bridge",
    readings: pair("part-bridge", SUNO_GLOSSARY,
      ["A bridge is the contrasting section, where a song turns away from its catchiest part. Do you listen for that turn?", "you listen for the turn a bridge makes"],
      ["Or do you listen for the story the verses tell?", "you listen for the story the verses tell"]),
    question: "Is there a moment in one of these songs you wait for each time?",
  },
  "part:a verse": {
    kind: "part:a verse",
    readings: pair("part-verse", SUNO_GLOSSARY,
      ["Verses are the sections that tell the story. Do you listen for the story more than the catchy parts?", "you listen for the story more than the catchy parts"],
      ["Or is it the sound of a verse, more than its words?", "the sound of a verse matters more to you than its words"]),
    question: "Is there a moment in one of these songs you wait for each time?",
  },
  "part:the chorus": {
    kind: "part:the chorus",
    readings: pair("part-chorus", SUNO_GLOSSARY,
      ["A chorus is the part that keeps coming back, usually the catchiest part. Is its return what you wait for?", "the chorus coming back is what you wait for"],
      ["Or is it how a song builds up to it?", "how a song builds up to its chorus is what you wait for"]),
    question: "Is there a moment in one of these songs you wait for each time?",
  },
  "part:the opening": {
    kind: "part:the opening",
    readings: pair("part-opening", SUNO_GLOSSARY,
      ["An intro is the opening section that sets up the song. Is it the first seconds that draw you in?", "the first seconds of a song draw you in"],
      ["Or does the opening stay with you simply because it comes first?", "the opening stays with you because it comes first"]),
    question: "Is there a moment in one of these songs you wait for each time?",
  },
  "part:the beat": {
    kind: "part:the beat",
    readings: pair("part-beat", SUNO_GLOSSARY,
      ["Groove is the rhythmic feel that makes you want to move. Is that feel what you come back for?", "the groove is what you come back for"],
      ["Or is the beat what carries you into the rest of the song?", "the beat carries you into the rest of the song"]),
    question: "Is there a moment in one of these songs you wait for each time?",
  },
  "part:the sound of it": {
    kind: "part:the sound of it",
    readings: pair("part-sound", SUNO_GLOSSARY,
      ["Timbre is the colour of a sound, what makes a guitar sound unlike a piano. Is that colour what you come back for?", "the colour of the sound is what you come back for"],
      ["Or is it how the sounds are put together?", "how the sounds are put together is what you come back for"]),
    question: "Is there a moment in one of these songs you wait for each time?",
  },
  "release-window": {
    kind: "release-window",
    readings: pair("release-window", LIB_3,
      ["People tend to hold on most to music from their teens and twenties. Did these songs come out around then for you?", "these songs may have come out around your teens or twenties"],
      ["Or did these songs reach you later?", "these songs reached you later"]),
    question: "What was happening in your life around then?",
  },
  "found-later": {
    kind: "found-later",
    readings: pair("found-later", LIB_3,
      ["People hold on to music from before their time too, often heard through someone older. Did someone bring these to you?", "someone may have brought these songs to you"],
      ["Or did you go back and find them yourself?", "you went back and found these songs yourself"]),
    question: "Do you remember how they found you?",
  },
  /*
   * FR-T9.3 (b): the period line. Its one reading is the finding of LIB-2 put as a question, answered
   * "Yes", "No, something else" or "Neither"; the two buttons are the two readings.
   */
  period: {
    kind: "period",
    readings: [
      { template_id: "period/a", ask: "Is a memory of a person, a period or a place what these records are for you?", kept: "these records may hold a memory of a person, a period or a place for you", grounding: LIB_2, answer: "Yes" },
      { template_id: "period/b", ask: "Or are these records something else for you?", kept: "these records are something other than a memory of a person, a period or a place for you", grounding: LIB_2, answer: "No, something else" },
    ],
    question: "What was happening in your life around then?",
  },
  "shared-person": {
    kind: "shared-person",
    readings: pair("shared-person", MUSICBRAINZ_ROLES,
      ["Do you hear one person's hand across these songs?", "one person's hand may be what you hear across these songs"],
      ["Or do these songs sound unrelated to you?", "these songs sound unrelated to you"]),
    question: "Which of these did you hear first, and where?",
  },
};

/** FR-T4.1's glossary: every role shown with its meaning beside it (rule 11). */
export const ROLE_MEANING: Record<CreditRole, string> = {
  producer: "the person who guides the recording and shapes how the record sounds",
  writer: "the person who wrote the music or the words",
  "recording engineer": "the person who captures the performance on the recording",
  mixer: "the person who balances the parts into the final sound",
  "mastering engineer": "the person who prepares the final mix for release, setting its overall loudness and tone",
  arranger: "the person who decides which instruments play which parts",
  programming: "drums or synths written on a computer rather than played live",
  performer: "a person who plays or sings on the recording",
};

/** Fill `{blank}`s; a blank with no value is an error, never left in a shown sentence. */
export function fill(pattern: string, values: Record<string, string>): string {
  return pattern.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = values[k];
    if (v === undefined) throw new Error(`template blank {${k}} has no value`);
    return v;
  });
}
