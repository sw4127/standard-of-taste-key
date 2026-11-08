/**
 * T5.7: read a Spotify export in the browser (FR-T5.7). The zip is opened with fflate (MIT); only
 * `Streaming_History_Audio_*.json` files are decompressed. Each play becomes a D11 row built from a
 * fixed list of fields, so the IP address and every other field are dropped as the file is read.
 * Plays with no track or artist (podcasts, audiobooks) are left out.
 *
 * Local time comes from the row's country (`conn_country`), approximate where a country spans time
 * zones: one zone stands for the country (its most populous one for the large countries listed below;
 * otherwise the first in the country's list). An unknown country uses this browser's own zone.
 */
import { getCountry } from "countries-and-timezones";
import { unzipSync } from "fflate";
import type { HistoryRow } from "./model";

export const AUDIO_FILE = /(^|\/)Streaming_History_Audio_[^/]*\.json$/;

const MAIN_ZONE: Record<string, string> = {
  US: "America/New_York", CA: "America/Toronto", MX: "America/Mexico_City", BR: "America/Sao_Paulo",
  AR: "America/Argentina/Buenos_Aires", CL: "America/Santiago", EC: "America/Guayaquil", RU: "Europe/Moscow",
  UA: "Europe/Kyiv", AU: "Australia/Sydney", NZ: "Pacific/Auckland", ID: "Asia/Jakarta", KZ: "Asia/Almaty",
  CN: "Asia/Shanghai", MN: "Asia/Ulaanbaatar", MY: "Asia/Kuala_Lumpur", ES: "Europe/Madrid", PT: "Europe/Lisbon",
  DE: "Europe/Berlin", CD: "Africa/Kinshasa", PG: "Pacific/Port_Moresby", UZ: "Asia/Tashkent", CY: "Asia/Nicosia",
  GL: "America/Nuuk", PF: "Pacific/Tahiti", FR: "Europe/Paris", NL: "Europe/Amsterdam", DK: "Europe/Copenhagen",
  GB: "Europe/London", NO: "Europe/Oslo", PS: "Asia/Hebron", KI: "Pacific/Tarawa", FM: "Pacific/Pohnpei",
};

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function zoneFor(country: string): { zone: string; approximate: boolean } {
  const c = getCountry(country.toUpperCase() as Parameters<typeof getCountry>[0]);
  if (!c) return { zone: browserZone(), approximate: true };
  const zone = MAIN_ZONE[c.id] ?? c.timezones.find((z) => !z.startsWith("Antarctica/")) ?? c.timezones[0]!;
  return { zone, approximate: c.timezones.length > 1 };
}

const formatters = new Map<string, Intl.DateTimeFormat>();
const offsets = new Map<string, number>();

/** Minutes the zone is ahead of UTC at that instant (cached by zone and UTC hour). */
function offsetAt(zone: string, utcMs: number, hourKey: string): number {
  const key = `${zone}|${hourKey}`;
  const hit = offsets.get(key);
  if (hit !== undefined) return hit;
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    formatters.set(zone, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  const minutes = Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
  offsets.set(key, minutes);
  return minutes;
}

/** Spotify's UTC `ts` as wall-clock time in the country's zone: "2026-07-14T21:05:33". */
export function localTime(tsUtc: string, country: string): string {
  const ms = Date.parse(tsUtc);
  if (Number.isNaN(ms)) return tsUtc.slice(0, 19);
  const { zone } = zoneFor(country || "ZZ");
  return new Date(ms + offsetAt(zone, ms, tsUtc.slice(0, 13)) * 60000).toISOString().slice(0, 19);
}

/** One play as Spotify writes it: only the fields read here are named. */
interface SpotifyPlay {
  ts?: unknown;
  ms_played?: unknown;
  conn_country?: unknown;
  master_metadata_track_name?: unknown;
  master_metadata_album_artist_name?: unknown;
  master_metadata_album_album_name?: unknown;
  spotify_track_uri?: unknown;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

export interface ReadResult {
  rows: HistoryRow[];
  /** How many Streaming_History_Audio files were read. */
  files: number;
  /** Plays left out because they name no track or artist (podcasts, audiobooks, damaged rows). */
  leftOut: number;
}

/** D11 rows from parsed JSON arrays: a fixed list of fields, everything else dropped here. */
export function toHistoryRows(plays: unknown[], person_id: string): { rows: HistoryRow[]; leftOut: number } {
  const rows: HistoryRow[] = [];
  let leftOut = 0;
  for (const raw of plays) {
    const p = raw as SpotifyPlay;
    const track = str(p.master_metadata_track_name);
    const artist = str(p.master_metadata_album_artist_name);
    const ts = str(p.ts);
    if (!track || !artist || !ts || typeof p.ms_played !== "number") {
      leftOut++;
      continue;
    }
    const country = str(p.conn_country);
    rows.push({
      history_id: `${person_id}:${rows.length}`,
      person_id,
      ended_at_utc: ts,
      local_time: localTime(ts, country),
      country,
      track_uri: str(p.spotify_track_uri),
      track,
      artist,
      album: str(p.master_metadata_album_album_name),
      ms_played: p.ms_played,
    });
  }
  return { rows, leftOut };
}

export class NotAnExport extends Error {}

/** Read a dropped file: a Spotify export .zip, or one Streaming_History_Audio_*.json from it. */
export function readExport(name: string, bytes: Uint8Array, person_id: string): ReadResult {
  const dec = new TextDecoder();
  const texts: string[] = [];
  if (/\.json$/i.test(name)) {
    if (!AUDIO_FILE.test(name)) throw new NotAnExport("not a Streaming_History_Audio file");
    texts.push(dec.decode(bytes));
  } else {
    let files: Record<string, Uint8Array>;
    try {
      files = unzipSync(bytes, { filter: (f) => AUDIO_FILE.test(f.name) });
    } catch {
      throw new NotAnExport("not a zip file");
    }
    for (const n of Object.keys(files).sort()) texts.push(dec.decode(files[n]!));
  }
  if (!texts.length) throw new NotAnExport("no Streaming_History_Audio files");
  const plays: unknown[] = [];
  for (const t of texts) {
    const parsed: unknown = JSON.parse(t);
    if (Array.isArray(parsed)) for (const x of parsed) plays.push(x);
  }
  const { rows, leftOut } = toHistoryRows(plays, person_id);
  rows.sort((a, b) => a.ended_at_utc.localeCompare(b.ended_at_utc));
  rows.forEach((r, i) => (r.history_id = `${person_id}:${i}`));
  return { rows, files: texts.length, leftOut };
}
