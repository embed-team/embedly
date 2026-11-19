import { EmbedlyErrors, formatLog, getErrorContext } from "@embedly/logging";

import { readAmazon, searchAmazon } from "./amazon";
import { appleToken, readApple, searchApple } from "./apple";
import type { MusicItem, MusicLink, MusicLinks, MusicProvider, MusicReference } from "./client";
import { clientToken, UpstreamError } from "./http";
import { matchMusic, normalizeTitle } from "./match";
import { readSpotify, searchSpotify } from "./spotify";
import { readTidal, searchTidal } from "./tidal";

const PROVIDERS = ["spotify", "appleMusic", "tidal", "amazonMusic"] as const;

export async function musicIdentity(item: MusicItem) {
  if (item.type === "track") return item.isrc ? `isrc:${item.isrc.toUpperCase()}` : null;
  if (!item.tracks?.length) return item.upc ? `upc:${item.upc.replace(/^0+/, "")}` : null;
  const identity = [
    item.title,
    ...item.artists.slice().sort(),
    ...item.tracks.map((track) => track.title),
  ]
    .map(normalizeTitle)
    .join("\n");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  return `album:${Buffer.from(digest).toString("hex")}`;
}

export async function resolveMusic(
  ref: MusicReference,
  env: CloudflareBindings,
  force: boolean,
): Promise<MusicLinks> {
  let spotifyAccess: Promise<string> | undefined;
  let appleAccess: Promise<string> | undefined;
  let tidalAccess: Promise<string> | undefined;
  let sourceAlbum: Promise<MusicItem> | undefined;

  const tokens = {
    appleMusic: () => (appleAccess ??= appleToken()),
    spotify: () =>
      (spotifyAccess ??= clientToken(
        "https://accounts.spotify.com/api/token",
        env.SPOTIFY_CLIENT_ID,
        env.SPOTIFY_CLIENT_SECRET,
      )),
    tidal: () =>
      (tidalAccess ??= clientToken(
        "https://auth.tidal.com/v1/oauth2/token",
        env.TIDAL_CLIENT_ID,
        env.TIDAL_CLIENT_SECRET,
      )),
  };

  async function read(ref: MusicReference) {
    switch (ref.provider) {
      case "spotify":
        return readSpotify(ref, await tokens.spotify());
      case "appleMusic":
        return readApple(ref, await tokens.appleMusic());
      case "tidal":
        return readTidal(ref, await tokens.tidal());
      case "amazonMusic":
        return readAmazon(ref);
    }
  }

  async function search(provider: MusicProvider, item: MusicItem) {
    switch (provider) {
      case "spotify":
        return searchSpotify(item, await tokens.spotify());
      case "appleMusic":
        return searchApple(item, await tokens.appleMusic());
      case "tidal":
        return searchTidal(item, await tokens.tidal());
      case "amazonMusic":
        return searchAmazon(item);
    }
  }

  async function find(provider: MusicProvider, item: MusicItem) {
    const track =
      item.type === "album" && !item.upc ? item.tracks?.find((track) => track.isrc) : undefined;
    const searchItem = track ? { ...item, ...track, type: "track" as const } : item;
    const refs = await search(provider, searchItem);
    const results = await Promise.allSettled(
      refs.slice(0, 5).map(async (ref) => {
        let candidate: MusicItem;
        try {
          candidate = await read(ref);
          if (track) {
            if (!matchMusic(searchItem, candidate) || !candidate.album) return null;
            candidate = await read(candidate.album);
          }
        } catch (error) {
          if (error instanceof UpstreamError && error.status === 404) return null;
          throw error;
        }
        const match = matchMusic(item, candidate);
        return match ? { item: candidate, match } : null;
      }),
    );
    const matches = results.flatMap((result) =>
      result.status === "fulfilled" && result.value ? [result.value] : [],
    );
    if (matches.length === 0) {
      const failure = results.find((result) => result.status === "rejected");
      if (failure) throw failure.reason;
    }
    return matches.sort(
      (a, b) =>
        Number(b.match === "upc") - Number(a.match === "upc") || a.item.id.localeCompare(b.item.id),
    )[0];
  }

  const source = await read(ref);
  const identity = await musicIdentity(source);
  if (!force && identity) {
    const cached = await env.CACHE.get<MusicLinks>(`v1:${identity}`, "json");
    if (cached && matchMusic(source, cached.item)) return { ...cached, source: ref };
  }

  const results = await Promise.allSettled(
    PROVIDERS.map(async (provider) => {
      if (provider === ref.provider) return { item: source, match: "source" as const };
      if (source.type === "album" || source.isrc) {
        const match = await find(provider, source);
        if (match) return match;
        if (source.type === "album") return null;
      }
      if (!source.album) return null;
      const album = await (sourceAlbum ??= read(source.album));
      const match = await find(provider, album);
      if (!match) return null;
      const index = album.tracks?.findIndex((track) => track.id === source.id) ?? -1;
      const track = index >= 0 ? match.item.tracks?.[index] : undefined;
      if (!track) return null;
      return {
        item: await read({ provider, type: "track", id: track.id, url: track.url }),
        match: "tracklist" as const,
      };
    }),
  );

  // SAFETY: Every fixed provider is assigned once from its corresponding settled result below.
  const links = {} as Record<MusicProvider, MusicLink>;
  const items: MusicItem[] = [];
  for (const [index, provider] of PROVIDERS.entries()) {
    const result = results[index]!;
    if (result.status === "rejected") {
      console.warn(
        formatLog("warn", EmbedlyErrors.PlatformFetchFailed, {
          source: "music",
          platform: provider,
          post_id: ref.id,
          ...getErrorContext(result.reason),
        }),
      );
      links[provider] = { status: "unavailable", reason: "Provider lookup failed" };
    } else if (!result.value) {
      links[provider] = { status: "not_found", reason: "No verified match found" };
    } else {
      const { item, match } = result.value;
      items.push(item);
      links[provider] = { status: "matched", id: item.id, url: item.url, match };
    }
  }
  const data: MusicLinks = { source: ref, item: items[0]!, links };
  const ttl = Object.values(links).some((link) => link.status === "unavailable") ? 60 : 3600;
  const keys = new Set(items.map((item) => `v1:${item.provider}:${item.type}:${item.id}`));
  for (const item of items) {
    const identity = await musicIdentity(item);
    if (identity) keys.add(`v1:${identity}`);
  }
  await Promise.all(
    [...keys].map((key) => env.CACHE.put(key, JSON.stringify(data), { expirationTtl: ttl })),
  );
  return data;
}
