/**
 * FR-T9.1 (additions of 2026-11-10): the search lists albums as well as songs, and an album is stored
 * as an album (its MusicBrainz release group, title, artist and first release date), never as its
 * title track. Stage 9: "Dawn FM" was stored as the album's 1 min 36 s intro.
 *
 * Only an official album with no secondary type (not a compilation, live album, soundtrack, remix
 * album, DJ-mix, demo or mixtape) is offered: the record an artist made as an album.
 */
import { albumId, type SongFacts } from "../model";
import { normalise } from "../match/studio";
import { getJson, realClock } from "./http";
import { lucene, MB, mbGate, type MbDeps } from "./musicbrainz";

export interface MbReleaseGroup {
  id: string;
  title: string;
  score?: number;
  "primary-type"?: string;
  "secondary-types"?: string[];
  "first-release-date"?: string;
  "artist-credit"?: { name: string; joinphrase?: string; artist: { id: string; name: string } }[];
}

export interface AlbumCandidate {
  key: string;
  kind: "album";
  release_group_id: string;
  title: string;
  artist_credit: string;
  lead_artist_id: string;
  lead_artist: string;
  year?: number;
}

export const MAX_ALBUMS = 3;

/** Every typed word must stand in the album's title or its artist, as for songs; the exact title is boosted. */
export function albumQuery(typed: string): string {
  const words = typed.trim().split(/\s+/).filter(Boolean).map(lucene);
  const each = words.map((w) => `(releasegroup:${w} OR artistname:${w})`).join(" AND ");
  return `(releasegroup:"${lucene(typed.trim())}"^5 OR (${each})) AND primarytype:album`;
}

const credit = (g: MbReleaseGroup) => (g["artist-credit"] ?? []).map((a) => a.name + (a.joinphrase ?? "")).join("");

/** Official studio albums from a release-group search, at most three, a title the person typed first. */
export function albumsFrom(groups: MbReleaseGroup[], typed: string): AlbumCandidate[] {
  const t = normalise(typed);
  return groups
    .filter((g) => g["primary-type"] === "Album" && !(g["secondary-types"] ?? []).length && (g.score ?? 0) >= 85 && g["artist-credit"]?.[0])
    .map((g, i) => ({ g, i, typedTitle: t.includes(normalise(g.title)) && normalise(g.title).length >= 2 }))
    .sort((a, b) => Number(b.typedTitle) - Number(a.typedTitle) || a.i - b.i)
    .slice(0, MAX_ALBUMS)
    .map(({ g }) => {
      const lead = g["artist-credit"]![0]!.artist;
      const d = g["first-release-date"];
      return {
        key: albumId(g.id), kind: "album" as const, release_group_id: g.id, title: g.title, artist_credit: credit(g), lead_artist_id: lead.id, lead_artist: lead.name,
        ...(d && /^\d{4}/.test(d) ? { year: Number(d.slice(0, 4)) } : {}),
      };
    });
}

export async function searchAlbums(typed: string, d: MbDeps): Promise<AlbumCandidate[]> {
  const q = typed.trim();
  if (q.length < 2) return [];
  const body = (await getJson(`${MB}/release-group?query=${encodeURIComponent(albumQuery(q))}&limit=25&fmt=json`, d.gate ?? mbGate, d.fetchFn, d.clock ?? realClock, d.cache)) as { "release-groups"?: MbReleaseGroup[] };
  return albumsFrom(body["release-groups"] ?? [], q);
}

/** The album as a record: no key, tempo or credits are read for it (FR-T9.1: albums take no part in key or tempo lines). */
export function albumFacts(c: AlbumCandidate): SongFacts {
  return {
    recording_id: albumId(c.release_group_id), kind: "album", release_group_id: c.release_group_id,
    title: c.title, artist_credit: c.artist_credit, lead_artist_id: c.lead_artist_id, lead_artist: c.lead_artist,
    ...(c.year ? { first_release_year: c.year } : {}),
    date_source: { label: "MusicBrainz", url: `https://musicbrainz.org/release-group/${c.release_group_id}` },
    date_disputed: false, people: [],
  };
}
