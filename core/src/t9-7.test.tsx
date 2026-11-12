// @vitest-environment happy-dom
/**
 * T9.7 Hear a tempo and a key (FR-T9.7). The acceptance test: the interval between clicks against
 * the tempo, and the chord's three pitches against the key. Made by the browser; nothing recorded.
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { Hear } from "../ui/Hear";
import { parseKey } from "./design/key-colour";
import { CHORD_SECONDS, clickTimes, CLICKS, frequency, homeChord, MADE_BY_BROWSER, playKey, playTempo, type AudioLike } from "./sound";

/** A stand-in for the Web Audio API that records what was scheduled. */
function fakeAudio() {
  const oscillators: { type: string; frequency: number; start: number; stop: number }[] = [];
  const ctx: AudioLike = {
    currentTime: 10,
    destination: {},
    createOscillator() {
      const o = { type: "", frequency: { value: 0 }, connect: () => undefined, start(t: number) { rec.start = t; }, stop(t: number) { rec.stop = t; } };
      const rec = { type: "", frequency: 0, start: 0, stop: 0 };
      oscillators.push(rec);
      return new Proxy(o, { set(target, k, v) { (target as Record<string | symbol, unknown>)[k] = v; if (k === "type") rec.type = v; return true; }, get(target, k) { if (k === "frequency") return { set value(v: number) { rec.frequency = v; }, get value() { return rec.frequency; } }; return (target as Record<string | symbol, unknown>)[k]; } });
    },
    createGain() {
      return { gain: { setValueAtTime: () => undefined, linearRampToValueAtTime: () => undefined }, connect: () => undefined };
    },
  };
  return { ctx, oscillators };
}

describe("the tempo: eight clicks, one beat apart", () => {
  for (const bpm of [60, 92, 120, 184]) {
    it(`${bpm} BPM: eight clicks, ${(60 / bpm).toFixed(3)} s apart`, () => {
      const t = clickTimes(bpm);
      expect(t).toHaveLength(CLICKS);
      for (let i = 1; i < t.length; i++) expect(t[i]! - t[i - 1]!).toBeCloseTo(60 / bpm, 9);
    });
  }
  it("what the browser is asked to play keeps the same spacing", () => {
    const { ctx, oscillators } = fakeAudio();
    const times = playTempo(ctx, 120);
    expect(oscillators).toHaveLength(8);
    expect(oscillators.map((o) => o.start)).toEqual(times);
    for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!).toBeCloseTo(0.5, 9);
  });
  it("no tempo, no clicks", () => {
    expect(clickTimes(0)).toEqual([]);
  });
});

describe("the key: its home chord, major or minor, for two seconds", () => {
  it("C major is C, E and G; A minor is A, C and E; B-flat major is B-flat, D and F", () => {
    expect(homeChord(parseKey("C", "major")!)).toEqual([60, 64, 67]);
    expect(homeChord(parseKey("A", "minor")!)).toEqual([69, 72, 76]);
    expect(homeChord(parseKey("A#", "major")!)).toEqual([70, 74, 77]);
  });
  it("the pitches are in tune: A above middle C is 440 Hz", () => {
    expect(frequency(69)).toBeCloseTo(440, 6);
    expect(homeChord(parseKey("C", "major")!).map(frequency).map((f) => Math.round(f * 100) / 100)).toEqual([261.63, 329.63, 392]);
  });
  it("what the browser is asked to play is those three pitches, for two seconds", () => {
    const { ctx, oscillators } = fakeAudio();
    const freqs = playKey(ctx, parseKey("A", "minor")!);
    expect(oscillators.map((o) => Math.round(o.frequency))).toEqual(freqs.map(Math.round));
    expect(freqs.map(Math.round)).toEqual([440, 523, 659]);
    for (const o of oscillators) expect(o.stop - o.start).toBeCloseTo(2, 9); // FR-T9.7: two seconds, as a number, not the constant
  });
});

describe("the control", () => {
  it("is labelled as made by the browser, and names the tempo and the key it plays", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<Hear bpm={92} k={parseKey("A#", "major")} />));
    expect(MADE_BY_BROWSER).toBe("Made by your browser. No recording is played.");
    expect(host.textContent).toContain(MADE_BY_BROWSER);
    expect(host.textContent).toContain("Hear this tempo (92 BPM)");
    expect(host.textContent).toContain("Hear this key (B-flat major)");
    act(() => root.unmount());
    host.remove();
  });
  it("plays nothing recorded: no audio element, no file, no address", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(__dirname, "sound.ts"), "utf8") + readFileSync(join(__dirname, "..", "ui", "Hear.tsx"), "utf8");
    expect(src).not.toMatch(/new Audio\(|<audio|\.mp3|\.wav|\.ogg|fetch\(|https?:\/\//);
  });
});
