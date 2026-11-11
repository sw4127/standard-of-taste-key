/**
 * OKLCH to sRGB (Card stock, second version; decision E9-6: the palette is computed from its rule).
 * OKLCH is a colour space built so that equal steps look equal to the eye: L is lightness (0 to 1),
 * C is colourfulness, H is the hue angle in degrees. The matrices are Björn Ottosson's published
 * Oklab constants (https://bottosson.github.io/posts/oklab/, public domain / MIT).
 */

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const fromLinear = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

/** Linear sRGB channels (each 0 to 1 when the screen can show the colour). */
function oklchToLinear(L: number, C: number, H: number): [number, number, number] {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/**
 * `#rrggbb` for an OKLCH colour. Where the screen cannot show the colour, the one channel that falls
 * outside 0 to 1 is held at its limit, and nothing else changes: this is the reading of "reduced only
 * where the screen cannot show it" that reproduces all twelve values in design rule 5.
 */
export function oklchToHex(L: number, C: number, H: number): string {
  return "#" + oklchToLinear(L, C, H).map((v) => Math.round(fromLinear(Math.min(1, Math.max(0, v))) * 255).toString(16).padStart(2, "0")).join("");
}

/** `#rrggbb` to OKLCH, for tests that check a token's lightness and hue family. */
export function hexToOklch(hex: string): { L: number; C: number; H: number } {
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255)) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), H: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}
