/**
 * T9.7 Hear a tempo and a key (FR-T9.7). Made by the browser's own sound engine (the Web Audio API);
 * nothing recorded is played (rule 7). An illustration, never scored.
 * - "Hear this tempo": eight clicks at that tempo.
 * - "Hear this key": that key's home chord, major or minor, for two seconds.
 */
import type { Key } from "./design/key-colour";

export const CLICKS = 8;
export const CHORD_SECONDS = 2;
export const MADE_BY_BROWSER = "Made by your browser. No recording is played.";

/** When each click sounds, in seconds from the first: one beat apart at the tempo. */
export function clickTimes(bpm: number, n = CLICKS): number[] {
  if (!(bpm > 0)) return [];
  return Array.from({ length: n }, (_, i) => (i * 60) / bpm);
}

/** The MIDI note number of the key's home note, in the octave from middle C (60) to the B above it (71). */
export const homeNote = (k: Key) => 60 + k.pitch;

/** The key's home chord as MIDI notes: home note, the third above it (4 semitones major, 3 minor) and the fifth (7). */
export function homeChord(k: Key): [number, number, number] {
  const r = homeNote(k);
  return [r, r + (k.mode === "major" ? 4 : 3), r + 7];
}

/** Equal temperament, A above middle C at 440 Hz. */
export const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** The smallest piece of the Web Audio API this uses, so a test can stand in for it. */
export interface AudioLike {
  currentTime: number;
  destination: unknown;
  createOscillator(): { type: string; frequency: { value: number }; connect(n: unknown): unknown; start(t: number): void; stop(t: number): void };
  createGain(): { gain: { setValueAtTime(v: number, t: number): void; linearRampToValueAtTime(v: number, t: number): void }; connect(n: unknown): unknown };
}

/** Schedule the clicks: a short, high tone on each beat. Returns the times scheduled, for a test. */
export function playTempo(ctx: AudioLike, bpm: number): number[] {
  const t0 = ctx.currentTime + 0.05;
  const times = clickTimes(bpm).map((t) => t0 + t);
  for (const t of times) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 1000;
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  }
  return times;
}

/** Schedule the home chord for two seconds, fading in and out so it never clicks. Returns its frequencies, for a test. */
export function playKey(ctx: AudioLike, k: Key): number[] {
  const t0 = ctx.currentTime + 0.05;
  const freqs = homeChord(k).map(frequency);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.15, t0 + 0.05);
  gain.gain.setValueAtTime(0.15, t0 + CHORD_SECONDS - 0.3);
  gain.gain.linearRampToValueAtTime(0, t0 + CHORD_SECONDS);
  gain.connect(ctx.destination);
  for (const f of freqs) {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = f;
    osc.connect(gain);
    osc.start(t0);
    osc.stop(t0 + CHORD_SECONDS);
  }
  return freqs;
}
