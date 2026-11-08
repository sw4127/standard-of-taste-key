/**
 * KEY COLOURS (PRD 6.1; design logic §2). The one colour that comes from the music.
 *
 * - The 12 major keys take hues in circle-of-fifths order, skipping the green band 75°–165°.
 * - A minor key takes its relative major's hue (same notes), at lightness 42% instead of 62%.
 * - Saturation 35%. The chip is the hue at 88% lightness behind ink, and always names the key.
 * - Shown only as a card's painted edge, the key chip and the taste note's swatches; never on text.
 *
 * Dark mode ("same hues, lightness adjusted for dark") is not given values in the spec. Chosen here,
 * and recorded in the build log: edges keep 62% / 42%, which both read against the dark card; the
 * chip drops to 22% lightness, the lightest at which the dark-mode ink (#E6ECE9) clears 7:1 on every
 * key (7.4:1 at worst; 24% gave 6.7:1).
 */

export type Mode = "major" | "minor";

/** Pitch classes: 0 = C, 1 = C♯/D♭, … 11 = B. */
const PITCH: Record<string, number> = {
  C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, F: 5, "E#": 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11,
};

/** Hue of each MAJOR key, by pitch class, in circle-of-fifths order (design logic §2). */
const MAJOR_HUE: Record<number, number> = {
  6: 180, // F♯/G♭
  1: 202, // D♭
  8: 224, // A♭
  3: 245, // E♭
  10: 267, // B♭
  5: 289, // F
  0: 311, // C
  7: 333, // G
  2: 355, // D
  9: 16, // A
  4: 38, // E
  11: 60, // B
};

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

export function keyHue(k: Key): number {
  return MAJOR_HUE[relativeMajor(k)]!;
}

/** The painted edge of a song's card. */
export function edgeColour(k: Key): string {
  return `hsl(${keyHue(k)} 35% ${k.mode === "major" ? 62 : 42}%)`;
}

/** The chip behind ink. `scheme` follows the system setting. */
export function chipColour(k: Key, scheme: "light" | "dark" = "light"): string {
  return `hsl(${keyHue(k)} 35% ${scheme === "light" ? 88 : 22}%)`;
}

/** All 24 keys in circle-of-fifths order from C, each major followed by its relative minor, so
 *  neighbouring keys sit next to each other and the colours read in order. */
export const ALL_KEYS: Key[] = Array.from({ length: 12 }, (_, i) => (i * 7) % 12).flatMap((p) => [
  { pitch: p, mode: "major" as const },
  { pitch: (p + 9) % 12, mode: "minor" as const },
]);
