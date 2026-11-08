/**
 * Card stock (PRD 6.1, design requirement; no task ID of its own). Proves the numbers the design
 * logic states, read from the one stylesheet that holds the tokens.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./readable-on";
import { ALL_KEYS, chipColour, edgeColour, keyHue, keyName, parseKey } from "./key-colour";

const css = readFileSync(fileURLToPath(new URL("../../design/cardstock.css", import.meta.url)), "utf8");

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)) out[m[1]!] = m[2]!.toLowerCase();
  return out;
}
const light = tokens(css.split("@media (prefers-color-scheme: dark)")[0]!);
const dark = tokens(/@media \(prefers-color-scheme: dark\)\s*{\s*:root\s*{([^}]*)}/.exec(css)![1]!);

describe("colour tokens: the values the design logic gives", () => {
  it("light mode", () => {
    expect(light).toMatchObject({
      ground: "#e4ece8", card: "#f3f6f2", ink: "#1b2220", quiet: "#454f4a", hairline: "#cbd6d0", action: "#4235ba",
    });
  });
  it("dark mode", () => {
    expect(dark).toMatchObject({
      ground: "#141a18", card: "#1c2421", ink: "#e6ece9", quiet: "#a9b5b0", hairline: "#2e3935", action: "#aea3ff",
    });
  });
});

describe("every text colour clears 7:1 on card and on ground, in both modes", () => {
  for (const [mode, t] of [["light", light], ["dark", dark]] as const) {
    for (const text of ["ink", "quiet", "action"]) {
      for (const surface of ["card", "ground"]) {
        it(`${mode}: ${text} on ${surface}`, () => {
          expect(contrastRatio(t[text]!, t[surface]!)!).toBeGreaterThanOrEqual(7);
        });
      }
    }
  }
});

describe("no status colours", () => {
  // A token reads as a signal light only if it is saturated; the ground's blue-green is near-neutral.
  function hsl(hex: string): [number, number] {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    if (d === 0) return [0, 0];
    const s = d / (1 - Math.abs(2 * l - 1));
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, s];
  }
  it("no token is a saturated green, red or amber", () => {
    expect(Object.keys(light).sort()).toEqual(["action", "card", "ground", "hairline", "ink", "quiet"]);
    for (const t of [light, dark]) {
      for (const [name, hex] of Object.entries(t)) {
        const [h, s] = hsl(hex);
        const signal = (h >= 75 && h <= 165) || h >= 345 || h <= 60;
        expect(s > 0.25 && signal, `${name} ${hex} hue ${h.toFixed(0)} sat ${s.toFixed(2)}`).toBe(false);
      }
    }
  });
});

describe("key colours", () => {
  it("major hues in circle-of-fifths order, as specified", () => {
    const hue = (name: string) => keyHue(parseKey(name, "major")!);
    expect([hue("F#"), hue("Db"), hue("Ab"), hue("Eb"), hue("Bb"), hue("F"), hue("C"), hue("G"), hue("D"), hue("A"), hue("E"), hue("B")])
      .toEqual([180, 202, 224, 245, 267, 289, 311, 333, 355, 16, 38, 60]);
  });
  it("no key wears the green band (75°–165°)", () => {
    for (const k of ALL_KEYS) expect(keyHue(k) < 75 || keyHue(k) > 165).toBe(true);
  });
  it("a minor key takes its relative major's hue, deeper", () => {
    const aMinor = parseKey("A", "minor")!;
    expect(keyHue(aMinor)).toBe(keyHue(parseKey("C", "major")!));
    expect(edgeColour(aMinor)).toBe("hsl(311 35% 42%)");
    expect(edgeColour(parseKey("C", "major")!)).toBe("hsl(311 35% 62%)");
  });
  it("every chip clears 11.3:1 behind light ink, and 7:1 behind dark ink", () => {
    for (const k of ALL_KEYS) {
      expect(contrastRatio(light.ink!, chipColour(k, "light"))!).toBeGreaterThanOrEqual(11.3);
      expect(contrastRatio(dark.ink!, chipColour(k, "dark"))!).toBeGreaterThanOrEqual(7);
    }
  });
  it("names the key in words", () => {
    expect(keyName(parseKey("A#", "major")!)).toBe("B-flat major");
    expect(keyName(parseKey("C#", "minor")!)).toBe("C-sharp minor");
    expect(parseKey("H", "major")).toBeNull();
  });
});

describe("four sizes only", () => {
  it("every font size in the stylesheet is one of 18, 13, 12, 11 px", () => {
    const sizes = new Set([...css.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1]!.trim()));
    const declared = [...css.matchAll(/--size-[a-z]+:\s*(\d+px)/g)].map((m) => m[1]);
    expect(declared).toEqual(["18px", "13px", "12px", "11px"]);
    for (const s of sizes) expect(s).toMatch(/^var\(--size-(line|body|meta|label)\)$/);
  });
});

describe("the key list", () => {
  it("holds all 24 keys once, majors beside their relative minors", () => {
    expect(new Set(ALL_KEYS.map((k) => keyName(k))).size).toBe(24);
    for (let i = 0; i < 24; i += 2) expect(keyHue(ALL_KEYS[i]!)).toBe(keyHue(ALL_KEYS[i + 1]!));
  });
});
