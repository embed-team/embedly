import type { MusicItem, MusicReference } from "./client";
import { durationMs, request, UpstreamError } from "./http";
import { normalizeTitle } from "./match";

interface TidalResource {
  id: string;
  type: string;
  attributes: {
    title?: string;
    name?: string;
    duration?: string;
    isrc?: string;
    barcodeId?: string;
    explicit?: boolean;
    releaseDate?: string;
    files?: { href: string }[];
  };
  relationships?: {
    artists?: { data: { id: string }[] };
    coverArt?: { data: { id: string }[] };
    albums?: { data: { id: string }[] };
    tracks?: { data: { id: string }[] };
    items?: { data: { id: string }[]; links?: { next?: string } };
  };
}

interface TidalPage {
  data: TidalResource | TidalResource[];
  included?: TidalResource[];
  links?: { next?: string };
}

export async function readTidal(ref: MusicReference, token: string): Promise<MusicItem> {
  const url = new URL(`https://openapi.tidal.com/v2/${ref.type}s/${ref.id}`);
  url.search = new URLSearchParams({
    countryCode: "US",
    include: ref.type === "album" ? "artists,coverArt,items" : "artists,albums,albums.coverArt",
  }).toString();
  const response = await request(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.api+json" },
  });
  // SAFETY: Tidal's catalog endpoints return JSON:API resources and their requested includes.
  const page = (await response.json()) as TidalPage;
  if (Array.isArray(page.data) || !page.data?.attributes.title)
    throw new UpstreamError("Tidal returned invalid music data");
  const resource = page.data;
  const included = new Map((page.included ?? []).map((item) => [`${item.type}:${item.id}`, item]));
  const trackIds = [...(resource.relationships?.items?.data ?? [])];
  let next = resource.relationships?.items?.links?.next;
  while (next) {
    const nextURL = next.startsWith("/") ? `https://openapi.tidal.com/v2${next}` : next;
    if (new URL(nextURL).origin !== "https://openapi.tidal.com")
      throw new UpstreamError("Tidal returned an invalid page URL");
    const response = await request(nextURL, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.api+json" },
    });
    // SAFETY: Tidal relationship pages contain ordered resource identifiers and included tracks.
    const page = (await response.json()) as TidalPage;
    if (!Array.isArray(page.data)) throw new UpstreamError("Tidal returned an invalid track page");
    trackIds.push(...page.data);
    for (const item of page.included ?? []) included.set(`${item.type}:${item.id}`, item);
    next = page.links?.next;
  }
  const artists = (resource.relationships?.artists?.data ?? [])
    .map((artist) => included.get(`artists:${artist.id}`)?.attributes.name)
    .filter((name) => name !== undefined);
  const albumId = resource.relationships?.albums?.data[0]?.id;
  const album = albumId ? included.get(`albums:${albumId}`) : resource;
  const artId = album?.relationships?.coverArt?.data[0]?.id;
  const artwork = artId
    ? included.get(`artworks:${artId}`)?.attributes.files?.[0]?.href
    : undefined;
  return {
    ...ref,
    title: resource.attributes.title!,
    artists,
    artwork,
    releaseDate: album?.attributes.releaseDate,
    durationMs: resource.attributes.duration ? durationMs(resource.attributes.duration) : undefined,
    explicit: resource.attributes.explicit,
    isrc: resource.attributes.isrc,
    upc: resource.attributes.barcodeId,
    album: albumId
      ? {
          provider: "tidal",
          type: "album",
          id: albumId,
          url: `https://tidal.com/browse/album/${albumId}`,
        }
      : undefined,
    tracks:
      ref.type === "album"
        ? trackIds.map(({ id }) => {
            const track = included.get(`tracks:${id}`);
            if (!track?.attributes.title || !track.attributes.duration)
              throw new UpstreamError("Tidal returned an incomplete tracklist");
            return {
              id,
              url: `https://tidal.com/browse/track/${id}`,
              title: track.attributes.title,
              durationMs: durationMs(track.attributes.duration),
              isrc: track.attributes.isrc,
              explicit: track.attributes.explicit,
            };
          })
        : undefined,
  };
}

export async function searchTidal(item: MusicItem, token: string) {
  const ids = new Set<string>();
  if ((item.type === "track" && item.isrc) || (item.type === "album" && item.upc)) {
    const url = new URL(`https://openapi.tidal.com/v2/${item.type}s`);
    url.search = new URLSearchParams({
      countryCode: "US",
      [item.type === "track" ? "filter[isrc]" : "filter[barcodeId]"]: item.isrc ?? item.upc!,
    }).toString();
    const response = await request(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.api+json" },
    });
    // SAFETY: Filtered Tidal catalog endpoints return arrays of the requested resources.
    const page = (await response.json()) as TidalPage;
    if (!Array.isArray(page.data)) throw new UpstreamError("Tidal returned invalid search data");
    for (const result of page.data) ids.add(result.id);
  }
  if (ids.size === 0) {
    const url = new URL("https://openapi.tidal.com/v2/searchResults");
    url.search = new URLSearchParams({
      "filter[query]": `${item.artists.join(" ")} ${item.title}`,
      countryCode: "US",
      include: `${item.type}s`,
    }).toString();
    const response = await request(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.api+json" },
    });
    // SAFETY: Tidal's query search returns a search resource and the requested catalog includes.
    const page = (await response.json()) as TidalPage;
    if (!Array.isArray(page.data)) throw new UpstreamError("Tidal returned invalid search data");
    for (const result of (page.included ?? []).filter(
      (result) =>
        result.type === `${item.type}s` &&
        result.attributes.title &&
        normalizeTitle(result.attributes.title) === normalizeTitle(item.title),
    ))
      ids.add(result.id);
  }
  return [...ids].map((id) => ({
    provider: "tidal" as const,
    type: item.type,
    id,
    url: `https://tidal.com/browse/${item.type}/${id}`,
  }));
}
