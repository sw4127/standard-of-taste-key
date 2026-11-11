/**
 * KEY COLOURS (Card stock, second version; PRD A3; design rules 4, 5 and 12; decision E9-6).
 * The one colour that comes from the music.
 *
 * - The twelve major keys run round the spectrum in circle-of-fifths order with C as red, in even
 *   steps of 30 degrees of hue in OKLCH (a colour space built so equal steps look equal), from 25
 *   degrees: lightness 0.58, chroma 0.105. Keys a fifth apart share six of their seven notes, so
 *   neighbouring keys get neighbouring colours.
 * - A minor key takes its relative major's hue (the same notes) at lightness 0.44 and chroma 0.085.
 * - Nothing here is typed in: every value is computed, and `card-stock.test.ts` checks the twelve
 *   against design rule 5 and each against the card.
 * - Shown only as the flat rule along a card's lower edge, the dots on the circle of keys and the
 *   taste note's swatches; never on text. The key is always named in words beside it.
 *
 * Dark mode (derived in the build, shown to Bob before it is kept): the same hues and chroma, with
 * the lightness raised to 0.74 (major) and 0.60 (minor), so the minor stays the darker of the pair,
 * the gap between them stays 0.14, and each clears 3.3:1 against the dark card.
 */
import { oklchToHex } from "./oklch";

export type Mode = "major" | "minor";

/** Pitch classes: 0 = C, 1 = C♯/D♭, … 11 = B. */
const PITCH: Record<string, number> = {
  C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, F: 5, "E#": 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11,
};

/** A major key's place on the circle of fifths: C 0, G 1, D 2, A 3, E 4, B 5, F-sharp 6, D-flat 7, A-flat 8, E-flat 9, B-flat 10, F 11. */
export const fifthsIndex = (majorPitch: number) => (majorPitch * 7) % 12;

/** The hue, in OKLCH degrees, of a major key: C is red (25), and each fifth adds 30. */
const FIRST_HUE = 25;

/** How a key is named in words, by pitch class, spelled as musicians usually spell that key. */
const MAJOR_NAME = ["C", "D-flat", "D", "E-flat", "E", "F", "F-sharp", "G", "A-flat", "A", "B-flat", "B"];
const MINOR_NAME = ["C", "C-sharp", "D", "E-flat", "E", "F", "F-sharp", "G", "G-sharp", "A", "B-flat", "B"];

export interface Key {
  pitch: number; // 0–11
  mode: Mode;
}

/** Read a key as AcousticBrainz writes it (`tonal.key_key` "A#", `tonal.key_scale` "minor"). */
export function parseKey(keyKey: string, keyScale: string): Key | null {
  const pitch = PITCH[keyKey.trim().replace("♯", "#").replace("♭", "b")];
  const scale = keyScale.trim().toLowerCase();
  if (pitch === undefined || (scale !== "major" && scale !== "minor")) return null;
  return { pitch, mode: scale };
}

export function keyName(k: Key): string {
  const names = k.mode === "major" ? MAJOR_NAME : MINOR_NAME;
  return `${names[k.pitch]} ${k.mode}`;
}

/** The relative major's pitch class: A minor → C major (three semitones up). */
export function relativeMajor(k: Key): number {
  return k.mode === "major" ? k.pitch : (k.pitch + 3) % 12;
}

/** The key's place on the circle: 0 (C major and A minor, at the top) to 11, clockwise by fifths. */
export const circlePlace = (k: Key) => fifthsIndex(relativeMajor(k));

export function keyHue(k: Key): number {
  return (FIRST_HUE + 30 * circlePlace(k)) % 360;
}

export type Scheme = "light" | "dark";
const TONE: Record<Scheme, Record<Mode, { L: number; C: number }>> = {
  light: { major: { L: 0.58, C: 0.105 }, minor: { L: 0.44, C: 0.085 } },
  dark: { major: { L: 0.74, C: 0.105 }, minor: { L: 0.6, C: 0.085 } },
};

/** The key's colour as `#rrggbb`: the card's lower rule, the dot on the circle, the note's swatch. */
export function keyColour(k: Key, scheme: Scheme = "light"): string {
  const t = TONE[scheme][k.mode];
  return oklchToHex(t.L, t.C, keyHue(k));
}

/** Both schemes at once, as CSS custom properties the stylesheet picks between. */
export const keyVars = (k: Key) => ({ ["--key-light" as string]: keyColour(k, "light"), ["--key-dark" as string]: keyColour(k, "dark") });

/** All 24 keys in circle-of-fifths order from C, each major followed by its relative minor, so
 *  neighbouring keys sit next to each other and the colours read in order. */
export const ALL_KEYS: Key[] = Array.from({ length: 12 }, (_, i) => (i * 7) % 12).flatMap((p) => [
  { pitch: p, mode: "major" as const },
  { pitch: (p + 9) % 12, mode: "minor" as const },
]);
