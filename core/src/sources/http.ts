/**
 * Polite fetching for FR-CORE-3: at most one call per interval to each service (MusicBrainz asks for
 * one per second; the PRD sets 1.2 s), a retry with back-off on HTTP 503, and an answer cache for the
 * page's life. Only a recording's name or ID ever leaves the browser (rule 6). Browsers do not let a
 * page set the User-Agent header, so none is sent; the request carries the page's own origin.
 */
export type FetchFn = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}
export const realClock: Clock = { now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };

export class Gate {
  private next = 0;
  private chain: Promise<void> = Promise.resolve();
  constructor(readonly intervalMs: number, private clock: Clock = realClock) {}
  /** Resolves when a call may go out; calls leave in the order they asked. */
  wait(): Promise<void> {
    const turn = this.chain.then(async () => {
      const t = this.clock.now();
      if (t < this.next) await this.clock.sleep(this.next - t);
      this.next = Math.max(t, this.next) + this.intervalMs;
    });
    this.chain = turn.catch(() => undefined);
    return turn;
  }
}

export class HttpError extends Error {
  constructor(readonly status: number, readonly url: string) {
    super(`HTTP ${status} from ${url}`);
  }
}

const BACKOFF_MS = [2000, 4000, 8000];

export async function getJson(url: string, gate: Gate, fetchFn: FetchFn, clock: Clock = realClock, cache?: Map<string, unknown>): Promise<unknown> {
  if (cache?.has(url)) return cache.get(url);
  for (let attempt = 0; ; attempt++) {
    await gate.wait();
    const res = await fetchFn(url);
    if (res.ok) {
      const body = await res.json();
      cache?.set(url, body);
      return body;
    }
    if (res.status === 503 && attempt < BACKOFF_MS.length) {
      await clock.sleep(BACKOFF_MS[attempt]!);
      continue;
    }
    throw new HttpError(res.status, url);
  }
}
