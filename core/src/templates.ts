/**
 * D4 Line Templates (PRD section 4): hand-written sentence patterns with blanks, shipped read-only.
 * Code fills the blanks; no model writes, chooses or judges any of it (rule 1).
 *
 * Every reading offered on a line across songs (T9.3) cites a fact about music, its grounding source.
 * A part with no cited definition (the voice, the words) has no readings, so its line is not shown.
 */
import type { CreditRole, Part } from "./model";

export interface Grounding {
  citation: string;
  url: string;
}

export const GAGNON_PERETZ: Grounding = {
  citation: "Gagnon & Peretz 2003, Cognition and Emotion: listeners hear major mode as happier and minor as sadder, with tempo the stronger cue",
  url: "https://doi.org/10.1080/02699930302279",
};
export const KRUMHANSL_ZUPNICK: Grounding = {
  citation: "Krumhansl & Zupnick 2013, Psychological Science 24(10): memories and preference peak for music of one's youth, with a second peak for the music of one's parents' generation",
  url: "https://doi.org/10.1177/0956797613486486",
};
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
  | "shared-person";

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
    readings: pair("key-major", GAGNON_PERETZ,
      ["Major keys tend to be heard as brighter. Is that brightness part of what pulls you in?", "a bright key may be part of what pulls you in"],
      ["Or do these songs feel nothing like bright to you?", "these songs feel nothing like bright to you"]),
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
    readings: pair("tempo", GAGNON_PERETZ,
      ["Listeners lean on tempo even more than key when a song sounds happy or sad to them. Is the pace these songs share part of the pull?", "the pace these songs share may be part of the pull"],
      ["Or do they feel like different speeds to you?", "these songs feel like different speeds to you"]),
    question: "What are you usually doing when you play these?",
  },
  "part:the bridge": {
    kind: "part:the bridge",
    readings: pair("part-bridge", SUNO_GLOSSARY,
      ["A bridge is the contrasting section, where a song turns away from its hook. Do you listen for that turn?", "you listen for the turn a bridge makes"],
      ["Or do you listen for the story the verses tell?", "you listen for the story the verses tell"]),
    question: "Is there a moment in one of these songs you wait for each time?",
  },
  "part:a verse": {
    kind: "part:a verse",
    readings: pair("part-verse", SUNO_GLOSSARY,
      ["Verses are the sections that tell the story. Do you listen for the story more than the hook?", "you listen for the story more than the hook"],
      ["Or is it the sound of a verse, more than its words?", "the sound of a verse matters more to you than its words"]),
    question: "Is there a moment in one of these songs you wait for each time?",
  },
  "part:the chorus": {
    kind: "part:the chorus",
    readings: pair("part-chorus", SUNO_GLOSSARY,
      ["A chorus is the main, repeated section that carries the hook. Is the hook's return what you wait for?", "the hook's return is what you wait for"],
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
    readings: pair("release-window", KRUMHANSL_ZUPNICK,
      ["People tend to hold on to music from the years it entered their lives. Were those years that mattered to you?", "the years these songs came out may have mattered to you"],
      ["Or did these songs reach you later?", "these songs reached you later"]),
    question: "What was happening in your life around then?",
  },
  "found-later": {
    kind: "found-later",
    readings: pair("found-later", KRUMHANSL_ZUPNICK,
      ["People also hold on to music from before their time, often heard through someone older. Did someone bring these to you?", "someone may have brought these songs to you"],
      ["Or did you go back and find them yourself?", "you went back and found these songs yourself"]),
    question: "Do you remember how they found you?",
  },
  "shared-person": {
    kind: "shared-person",
    readings: pair("shared-person", MUSICBRAINZ_ROLES,
      ["The same {role} worked on songs by different singers here. Do you hear one person's hand across them?", "one person's hand may be what you hear across these songs"],
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
