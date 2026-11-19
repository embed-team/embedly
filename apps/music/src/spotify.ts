import type { MusicItem, MusicReference } from "./client";
import { request, UpstreamError } from "./http";
import { normalizeTitle } from "./match";

interface SpotifyAlbum {
  id: string;
  name: string;
  artists: { name: string }[];
  images: { url: string }[];
  release_date: string;
  external_ids: { upc?: string };
  tracks: { items: SpotifyTrack[]; next: string | null };
}

interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
  explicit: boolean;
  artists: { name: string }[];
  external_ids?: { isrc?: string };
  album?: SpotifyAlbum;
}

export async function readSpotify(ref: MusicReference, token: string): Promise<MusicItem> {
  const response = await request(`https://api.spotify.com/v1/${ref.type}s/${ref.id}?market=US`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (ref.type === "track") {
    // SAFETY: The Spotify track endpoint returns a track and its album metadata.
    const track = (await response.json()) as SpotifyTrack;
    if (!track.id || !track.album) throw new UpstreamError("Spotify returned invalid track data");
    return {
      ...ref,
      title: track.name,
      artists: track.artists.map((artist) => artist.name),
      artwork: track.album.images[0]?.url,
      releaseDate: track.album.release_date,
      albumTitle: track.album.name,
      durationMs: track.duration_ms,
      explicit: track.explicit,
      isrc: track.external_ids?.isrc,
      album: {
        provider: "spotify",
        type: "album",
        id: track.album.id,
        url: `https://open.spotify.com/album/${track.album.id}`,
      },
    };
  }
  // SAFETY: The Spotify album endpoint returns album metadata and paginated simplified tracks.
  const album = (await response.json()) as SpotifyAlbum;
  if (!album.id || !album.tracks?.items)
    throw new UpstreamError("Spotify returned invalid album data");
  const tracks = [...album.tracks.items];
  let next = album.tracks.next;
  while (next) {
    const nextURL = new URL(next);
    if (nextURL.origin !== "https://api.spotify.com")
      throw new UpstreamError("Spotify returned an invalid page URL");
    const pageResponse = await request(nextURL, { headers: { Authorization: `Bearer ${token}` } });
    // SAFETY: Spotify's next URL returns the same simplified-track page shape.
    const page = (await pageResponse.json()) as SpotifyAlbum["tracks"];
    tracks.push(...page.items);
    next = page.next;
  }
  return {
    ...ref,
    title: album.name,
    artists: album.artists.map((artist) => artist.name),
    artwork: album.images[0]?.url,
    releaseDate: album.release_date,
    upc: album.external_ids.upc,
    durationMs: tracks.reduce((sum, track) => sum + track.duration_ms, 0),
    tracks: await Promise.all(
      tracks.map(async (track) => {
        const item = await readSpotify(
          {
            provider: "spotify",
            type: "track",
            id: track.id,
            url: `https://open.spotify.com/track/${track.id}`,
          },
          token,
        );
        return {
          id: track.id,
          url: item.url,
          title: track.name,
          durationMs: track.duration_ms,
          explicit: track.explicit,
          isrc: item.isrc,
        };
      }),
    ),
  };
}

export async function searchSpotify(item: MusicItem, token: string) {
  const query =
    item.type === "track" && item.isrc
      ? `isrc:${item.isrc}`
      : item.type === "album" && item.upc
        ? `upc:${item.upc}`
        : `artist:${item.artists.join(" ")} ${item.type}:${item.title}`;
  const url = new URL("https://api.spotify.com/v1/search");
  url.search = new URLSearchParams({
    q: query,
    type: item.type,
    market: "US",
    limit: "10",
  }).toString();
  const response = await request(url, { headers: { Authorization: `Bearer ${token}` } });
  // SAFETY: Spotify search groups catalog results by the requested entity type.
  const data = (await response.json()) as {
    tracks?: { items: SpotifyTrack[] };
    albums?: { items: SpotifyAlbum[] };
  };
  return (item.type === "track" ? (data.tracks?.items ?? []) : (data.albums?.items ?? []))
    .filter(
      (result) =>
        item.isrc || item.upc || normalizeTitle(result.name) === normalizeTitle(item.title),
    )
    .map((result) => ({
      provider: "spotify" as const,
      type: item.type,
      id: result.id,
      url: `https://open.spotify.com/${item.type}/${result.id}`,
    }));
}
