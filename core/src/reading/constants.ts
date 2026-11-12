/**
 * FR-T9.9, the model for the reading (Amendment of 2026-11-11): the current Claude Sonnet model as
 * Anthropic's own models page listed it on the day of the build. One dated file; the build log
 * records the same identifier and price. No other level or maker (E9-1, E9-7).
 */

/** The day the models page and the pricing page were opened and read. */
export const LOOKED_UP = "2026-11-12";
export const MODELS_PAGE = "https://platform.claude.com/docs/en/about-claude/models/overview";
export const PRICING_PAGE = "https://platform.claude.com/docs/en/about-claude/pricing";

/** "Claude API ID" and name, as the models page lists them. */
export const MODEL_ID = "claude-sonnet-5-5";
export const MODEL_NAME = "Claude Sonnet 5.5";
/** The listed base price, in US dollars per million tokens (a token is a piece of a word). */
export const PRICE_PER_MILLION = { input: 2, output: 10 } as const;

export const PROVIDER = "anthropic";
/** The only address the key is ever sent to. */
export const API_HOST = "api.anthropic.com";

/** The longest answer a reading may cost, in tokens: 2,000 tokens of output is 2 cents at the price above. */
export const MAX_OUTPUT_TOKENS = 2000;
/** A reading's answer is usually about this long, in tokens (two guesses as JSON). Used only for the cost notice. */
export const TYPICAL_OUTPUT_TOKENS = 600;
/** About 2.5 characters to a token on the current tokenizer (the models page: 1M tokens is about 2.5M characters). */
export const CHARS_PER_TOKEN = 2.5;

/** What a call with this many characters sent should cost, in US cents, at the listed price. */
export function estimateCents(charsSent: number, outputTokens = TYPICAL_OUTPUT_TOKENS): number {
  const input = Math.ceil(charsSent / CHARS_PER_TOKEN);
  return ((input * PRICE_PER_MILLION.input + outputTokens * PRICE_PER_MILLION.output) / 1_000_000) * 100;
}

/** The estimate rounded to the nearest cent, never below one: "About 1 cent", "About 2 cents". */
export function aboutCents(cents: number): string {
  const n = Math.max(1, Math.round(cents));
  return n === 1 ? "About 1 cent" : `About ${n} cents`;
}
