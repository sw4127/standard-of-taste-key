// @vitest-environment happy-dom
/**
 * Card stock, second version (PRD A3, design requirement; design rules 1 to 12 of 2026-11-10).
 * Proves the numbers the rules state, read from the one stylesheet that holds the tokens, and the
 * rules that can only be seen on a drawn screen: no text on the ground, one filled button at most,
 * no outline-only button.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import WebHome from "../../../web/app/page";
import { PanelFoot, PanelHead, SiteFoot, SiteHead } from "../../ui/Chrome";
import { Judge } from "../../ui/Judge";
import { CIRCLE_SENTENCES, KeyChip, KeyCircle } from "../../ui/KeyChip";
import { LookBack } from "../../ui/LookBack";
import { MyNumbers } from "../../ui/MyNumbers";
import { NavContext } from "../../ui/nav";
import { NowPlaying } from "../../ui/NowPlaying";
import { PanelHome } from "../../ui/PanelHome";
import { SongCardExample } from "../../ui/SongCardExample";
import { Songs } from "../../ui/Songs";
import { seedForTests, type State } from "../../ui/store";
import { TasteNote } from "../../ui/TasteNote";
import { EXAMPLE_CATALOGUE, exampleHistory } from "../examples";
import type { NamedSong } from "../model";
import type { Choice, Words } from "../note";
import { FRIEND, play } from "../testing/panel";
import { circlePlaces, LARGE, placeXY, sizeStep } from "./key-circle";
import { ALL_KEYS, circlePlace, keyColour, keyHue, keyName, parseKey } from "./key-colour";
import { hexToOklch } from "./oklch";
import { contrastRatio } from "./readable-on";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "../../design/cardstock.css"), "utf8");
const shells = ["../../../web/app/site.css", "../../../extension/src/panel.css"].map((p) => readFileSync(resolve(here, p), "utf8"));
const allCss = [css, ...shells].join("\n");

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)) out[m[1]!] = m[2]!.toLowerCase();
  return out;
}
const light = tokens(css.split("@media (prefers-color-scheme: dark)")[0]!);
const dark = tokens(/@media \(prefers-color-scheme: dark\)\s*{\s*:root\s*{([^}]*)}/.exec(css)![1]!);

describe("colour tokens (design rules 1 and 8)", () => {
  it("light mode: the card is the eggshell, the ground the stone tone, the button's two colours as ruled", () => {
    expect(light).toMatchObject({ card: "#e4ece8", ground: "#c3cdc8", ink: "#1b2220", quiet: "#454f4a", action: "#4235ba", "on-action": "#f3f6f2" });
  });
  it("both modes hold the same tokens, each with one job", () => {
    expect(Object.keys(light).sort()).toEqual(["action", "card", "ground", "hairline", "ink", "on-action", "quiet", "tick"]);
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });
  for (const [mode, t] of [["light", light], ["dark", dark]] as const) {
    it(`${mode}: the ground is the card's own family, one step deeper, and the card is the lighter of the two`, () => {
      const card = hexToOklch(t.card!), ground = hexToOklch(t.ground!);
      expect(card.L).toBeGreaterThan(ground.L);
      expect(card.L - ground.L).toBeGreaterThan(0.08);
      expect(card.L - ground.L).toBeLessThan(0.11);
      expect(Math.abs(card.H - ground.H)).toBeLessThan(10);
      // Rule 7: large areas stay near grey.
      expect(card.C).toBeLessThan(0.02);
      expect(ground.C).toBeLessThan(0.02);
    });
    for (const text of ["ink", "quiet", "action"]) {
      it(`${mode}: ${text} clears 7:1 on the card`, () => {
        expect(contrastRatio(t[text]!, t.card!)!).toBeGreaterThanOrEqual(7);
      });
    }
    it(`${mode}: the answer picked, ink on a flat tag in the ground's tone, clears 7:1`, () => {
      expect(contrastRatio(t.ink!, t.ground!)!).toBeGreaterThanOrEqual(7);
    });
    it(`${mode}: the words on the filled button clear 7:1 on it`, () => {
      expect(contrastRatio(t["on-action"]!, t.action!)!).toBeGreaterThanOrEqual(7);
    });
  }
});

describe("flat (design rule 3)", () => {
  it("no shadow, gradient, background image or filter in any stylesheet", () => {
    expect(allCss).not.toMatch(/box-shadow|text-shadow|drop-shadow|gradient\(|background-image|url\(|filter\s*:|backdrop-filter/i);
  });
  it("the card has no border but the key's rule along its lower edge", () => {
    const card = /\n\.card\s*{([^}]*)}/.exec(css)![1]!;
    expect(card).not.toMatch(/border(?!-radius)/);
    expect(/\n\.keyed\s*{([^}]*)}/.exec(css)![1]!).toMatch(/border-bottom:\s*3px solid var\(--key\)/);
    expect(css).not.toMatch(/border-left/);
  });
});

describe("what can be pressed (design rule 8)", () => {
  const rules = [...allCss.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+){([^{}]*)}/g)].map((m) => ({ selector: m[1]!.trim(), body: m[2]! }));
  it("no outline-only button: nothing pressable is drawn as a border", () => {
    const pressable = rules.filter((r) => /\.act|\.choice|button/.test(r.selector));
    expect(pressable.length).toBeGreaterThan(5);
    for (const r of pressable) expect(r.body.replace(/border-radius[^;]*;/g, "").replace(/border:\s*0;/g, ""), r.selector).not.toMatch(/border/);
    expect(allCss).not.toMatch(/act-button/);
  });
  it("the action colour is used only on what can be pressed and on the focus ring", () => {
    const users = rules.filter((r) => /var\(--action\)/.test(r.body)).map((r) => r.selector.replace(/\s+/g, " "));
    expect(users.sort()).toEqual([".act", ".act-fill", ".found-range", ":focus-visible"]);
  });
  it("a link is underlined, and the filled button is a flat fill in the action colour", () => {
    expect(/\n\.act\s*{([^}]*)}/.exec(css)![1]!).toMatch(/text-decoration:\s*underline;/);
    const fill = /\n\.act-fill\s*{([^}]*)}/.exec(css)![1]!;
    expect(fill).toMatch(/background:\s*var\(--action\)/);
    expect(fill).toMatch(/color:\s*var\(--on-action\)/);
  });
});

describe("the twelve key colours (design rule 5), recomputed from the rule", () => {
  const RULE_5 = { C: "#b0605a", G: "#aa6838", D: "#977523", A: "#798131", E: "#508b52", B: "#158e77", "F#": "#008b98", Db: "#2c83af", Ab: "#5c78b9", Eb: "#7f6db2", Bb: "#99649c", F: "#aa5e7d" };
  it("each major key's colour is the value the rule lists", () => {
    for (const [name, hex] of Object.entries(RULE_5)) expect(keyColour(parseKey(name, "major")!), name).toBe(hex);
  });
  it("the hues run in circle-of-fifths order from C as red, in even steps", () => {
    const order = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"].map((n) => keyHue(parseKey(n, "major")!));
    expect(order).toEqual([25, 55, 85, 115, 145, 175, 205, 235, 265, 295, 325, 355]);
  });
  it("lightness 0.58 and chroma 0.105, reduced only where the screen cannot show it", () => {
    for (const k of ALL_KEYS.filter((k) => k.mode === "major")) {
      const c = hexToOklch(keyColour(k));
      expect(c.L, keyName(k)).toBeCloseTo(0.58, 2);
      expect(c.C, keyName(k)).toBeGreaterThan(0.099);
      expect(c.C, keyName(k)).toBeLessThan(0.107);
    }
  });
  it("a minor key takes its relative major's hue at lightness 0.44", () => {
    const fMinor = parseKey("F", "minor")!;
    expect(keyHue(fMinor)).toBe(keyHue(parseKey("Ab", "major")!));
    expect(keyColour(fMinor)).toBe("#3b5181");
    for (const k of ALL_KEYS.filter((k) => k.mode === "minor")) expect(hexToOklch(keyColour(k)).L).toBeCloseTo(0.44, 2);
  });
  it("every key colour clears 3.3:1 against the card in light mode, and 3:1 in dark mode", () => {
    for (const k of ALL_KEYS) {
      expect(contrastRatio(keyColour(k, "light"), light.card!)!, keyName(k)).toBeGreaterThanOrEqual(3.3);
      expect(contrastRatio(keyColour(k, "dark"), dark.card!)!, keyName(k)).toBeGreaterThanOrEqual(3);
    }
  });
  it("in both modes the minor key is the darker of the pair, so a dark dot marks a minor key", () => {
    for (const scheme of ["light", "dark"] as const) {
      for (let i = 0; i < 24; i += 2) expect(hexToOklch(keyColour(ALL_KEYS[i + 1]!, scheme)).L).toBeLessThan(hexToOklch(keyColour(ALL_KEYS[i]!, scheme)).L - 0.1);
    }
  });
  it("neighbouring keys differ: no two of the twelve are nearly the same colour", () => {
    const majors = ALL_KEYS.filter((k) => k.mode === "major").map((k) => hexToOklch(keyColour(k)));
    for (let i = 0; i < 12; i++) {
      const a = majors[i]!, b = majors[(i + 1) % 12]!;
      const dh = Math.min(Math.abs(a.H - b.H), 360 - Math.abs(a.H - b.H));
      expect(dh).toBeGreaterThan(25);
    }
  });
  it("names the key in words", () => {
    expect(keyName(parseKey("A#", "major")!)).toBe("B-flat major");
    expect(keyName(parseKey("C#", "minor")!)).toBe("C-sharp minor");
    expect(parseKey("H", "major")).toBeNull();
  });
  it("holds all 24 keys once, majors beside their relative minors", () => {
    expect(new Set(ALL_KEYS.map((k) => keyName(k))).size).toBe(24);
    for (let i = 0; i < 24; i += 2) expect(keyHue(ALL_KEYS[i]!)).toBe(keyHue(ALL_KEYS[i + 1]!));
  });
});

describe("the circle of keys (design rules 6 and 12)", () => {
  it("twelve places, never one per song: C at the top, each step clockwise a fifth", () => {
    expect(circlePlace(parseKey("C", "major")!)).toBe(0);
    expect(circlePlace(parseKey("A", "minor")!)).toBe(0);
    expect(circlePlace(parseKey("G", "major")!)).toBe(1);
    expect(circlePlace(parseKey("F", "major")!)).toBe(11);
    expect(placeXY(0, 45, 150)).toEqual({ x: 75, y: 30 });
    expect(placeXY(3, 45, 150)).toEqual({ x: 120, y: 75 });
    const fourteen = [...Array(4).fill(["A#", "major"]), ["G#", "major"], ["G#", "major"], ["F", "minor"], ["A", "major"], ["A", "major"], ["G", "major"], ["E", "major"], ["C#", "major"], ["D#", "major"], ["F", "major"]].map(([k, m]) => parseKey(k!, m!)!);
    const places = circlePlaces(fourteen);
    expect(places).toHaveLength(12);
    expect(places.reduce((n, p) => n + p.total, 0)).toBe(14);
    expect(places[10]).toMatchObject({ total: 4, step: 3 });
    expect(places[8]).toMatchObject({ total: 3, major: 2, minor: 1, step: 2 });
  });
  it("the dot grows in four steps: none, one, two or three, four or more", () => {
    expect([0, 1, 2, 3, 4, 9].map(sizeStep)).toEqual([0, 1, 2, 2, 3, 3]);
    expect([...LARGE.radius]).toEqual([...LARGE.radius].sort((a, b) => a - b));
  });
  it("two neighbours never touch, even at the largest step", () => {
    const a = placeXY(0, LARGE.ring, LARGE.size), b = placeXY(1, LARGE.ring, LARGE.size);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(2 * LARGE.radius[3] + 2);
  });
  it("the sentences are design rule 6's, word for word", () => {
    expect(CIRCLE_SENTENCES).toBe("Twelve musical keys form a circle. Neighboring keys share all but one of their seven notes, so they get similar colors. Dark dots mark minor keys. Large dots are the keys of your songs.");
  });
});

describe("four sizes only", () => {
  it("every font size in every stylesheet is one of 18, 13, 12, 11 px", () => {
    const sizes = new Set([...allCss.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1]!.trim()));
    const declared = [...css.matchAll(/--size-[a-z]+:\s*(\d+px)/g)].map((m) => m[1]);
    expect(declared).toEqual(["18px", "13px", "12px", "11px"]);
    expect(sizes.size).toBeGreaterThan(0);
    for (const s of sizes) expect(s).toMatch(/^var\(--size-(line|body|meta|label)\)$/);
  });
});

// ---- The drawn screens ------------------------------------------------------------------------------

const nav = { go: () => {} };
const panel = (body: ReactNode, atHome = false) => (
  <NavContext.Provider value={nav}>
    <div className="panel">
      <PanelHead atHome={atHome} onHome={() => {}} />
      <main className="panel-body stack-lg">{body}</main>
      <PanelFoot />
    </div>
  </NavContext.Provider>
);
const site = (body: ReactNode) => (
  <NavContext.Provider value={{ ...nav, href: (v) => `/${v}/` }}>
    <div className="site">
      <SiteHead />
      <main className="site-main">{body}</main>
      <SiteFoot />
    </div>
  </NavContext.Provider>
);

const named: NamedSong[] = EXAMPLE_CATALOGUE.slice(0, 7).map((f, i) => ({
  entry_id: `e${i}`, person_id: "me", typed_text: f.title, recording_id: f.recording_id,
  comes_back_for: i % 2 ? "the bridge" : "the chorus", found_me: "longer ago", entered_at: "2026-11-10T10:00:00Z",
}));
const choice = (n: number): Choice => ({
  question_id: `q${n}`, person_id: "me", source: "named songs", pattern_kind: "release window", pattern_text: "Four of your seven songs came out between 2019 and 2021.",
  evidence: [], readings_offered: ["a", "b"], readings_kept: ["You said: those years mattered to you.", "You said: these songs reached you later."], choice: "first", answered_at: "2026-11-10T10:00:00Z", dropped: false,
} as unknown as Choice);
const words: Words[] = [{ words_id: "w1", person_id: "me", template_id: "t", about: { question_id: "q1" }, text: "I was moving between two cities that year.", written_at: "2026-11-10T10:00:00Z", in_note: true } as unknown as Words];
const facts = Object.fromEntries(EXAMPLE_CATALOGUE.map((f) => [f.recording_id, f]));
const SEEDED: Partial<State> = {
  people: [{ person_id: "me", label: "me", source: "named songs", loaded_at: "2026-11-10T10:00:00Z" }, FRIEND],
  songs: named, facts, choices: [choice(1), choice(2)], words,
  histories: { [FRIEND.person_id]: exampleHistory().map((r) => ({ ...r, person_id: FRIEND.person_id })) },
  plays: [play(EXAMPLE_CATALOGUE[0]!, "2026-11-08T21:00:00"), play(EXAMPLE_CATALOGUE[1]!, "2026-11-09T21:00:00"), play(null, "2026-11-09T22:00:00")],
  installed_at: "2026-11-07T10:00:00Z",
};
const live = { facts: { video_id: "BV1ex4y1Ex99", part_number: 1, page_title: "Juniper Varga《Glass Harbour》", uploader_name: "Example Uploader", uploader_id: "1", list_title: "", list_position: null, page_tags: [] }, play_token: "t1", heard_seconds: 61, playing: true, ended: false };

const SCREENS: Record<string, () => ReactNode> = {
  "panel: home": () => panel(<PanelHome />, true),
  "panel: a video playing": () => panel(<><NowPlaying live={live} /><PanelHome playing /></>, true),
  "panel: the example song card": () => panel(<SongCardExample />),
  "panel: name songs": () => panel(<Songs />),
  "panel: the look back": () => panel(<LookBack />),
  "panel: the taste note": () => panel(<TasteNote />),
  "panel: judging": () => panel(<Judge />),
  "panel: my numbers": () => panel(<MyNumbers />),
  "website: the first page": () => site(<WebHome />),
  "website: name songs": () => site(<Songs />),
  "website: the look back": () => site(<LookBack />),
  "website: the taste note": () => site(<TasteNote />),
  "website: judging": () => site(<Judge />),
  "website: my numbers": () => site(<MyNumbers />),
  "a card that names its key, and the large circle": () => panel(<article className="card"><KeyChip k={parseKey("A#", "major")!} /><KeyChip k={null} /><KeyCircle keys={[parseKey("A#", "major")!, parseKey("A#", "major")!, parseKey("F", "minor")!]} onPick={() => {}} /><p className="record">{CIRCLE_SENTENCES}</p></article>),
};

let unmount: (() => void) | null = null;
let opened = 0;
async function draw(node: ReactNode): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(node);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
  unmount = () => {
    act(() => root.unmount());
    host.remove();
  };
  return host;
}

/** Every piece of text the screen shows, with whether a card holds it. */
function textOnTheGround(host: HTMLElement): string[] {
  const loose: string[] = [];
  const walk = (n: Node) => {
    if (n.nodeType === 3) {
      const text = (n.textContent ?? "").trim();
      if (text && !(n.parentElement as Element | null)?.closest(".card")) loose.push(text);
      return;
    }
    n.childNodes.forEach(walk);
  };
  walk(host);
  // Anything pressable or typed into must sit on a card too, words or not.
  host.querySelectorAll("button, a, input, textarea, select, svg").forEach((el) => {
    if (!el.closest(".card")) loose.push(`<${el.tagName.toLowerCase()}>`);
  });
  return loose;
}

describe("the drawn screens (design rules 2 and 8)", () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("fetch", () => Promise.reject(new Error("no network in tests")));
  });
  afterEach(() => {
    unmount?.();
    unmount = null;
  });

  for (const [state, rows] of [["nothing saved yet", {}], ["songs, plays, a friend's file and kept readings", SEEDED]] as const) {
    describe(state, () => {
      for (const [name, screen] of Object.entries(SCREENS)) {
        it(`${name}: no text or control on the ground; one filled button at most; no outline-only button`, async () => {
          seedForTests(rows);
          const host = await draw(screen());
          expect(host.textContent!.length).toBeGreaterThan(40);
          expect(textOnTheGround(host)).toEqual([]);
          expect(host.querySelectorAll(".act-fill").length).toBeLessThanOrEqual(1);
          expect(host.querySelectorAll(".act-button").length).toBe(0);
          // The ground itself is never a card, and a card never sits inside another.
          expect(host.querySelectorAll(".card .card").length).toBe(0);
          // Everything a tap opens (the evidence, a form, the Fix list) must land on a card too.
          const closed = [...host.querySelectorAll<HTMLElement>('button[aria-expanded="false"]')];
          for (const b of closed) {
            if (!b.isConnected) continue;
            await act(async () => {
              b.click();
              await new Promise((r) => setTimeout(r, 5));
            });
          }
          expect(textOnTheGround(host), "after opening what can be opened").toEqual([]);
          expect(host.querySelectorAll(".card .card").length).toBe(0);
          opened += closed.length;
        });
      }
    });
  }

  it("the screens above did open something: the opened states were really drawn", () => {
    expect(opened).toBeGreaterThan(10);
  });

  it("a card with a measured key carries the rule and names the key; one without says so and has no rule", async () => {
    seedForTests(SEEDED);
    const host = await draw(site(<Songs />));
    const keyed = [...host.querySelectorAll(".card.keyed")];
    expect(keyed.length).toBeGreaterThan(0);
    for (const c of keyed) expect(c.querySelector(".key-name")!.textContent).toMatch(/ (major|minor)$/);
    const bare = [...host.querySelectorAll("li.card:not(.keyed)")];
    expect(bare.length).toBeGreaterThan(0);
    for (const c of bare) expect(c.textContent).toContain("Key not measured");
  });
});
