import type { MusicItem, MusicLink } from "./client";

export function normalizeTitle(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function matchMusic(
  source: MusicItem,
  candidate: MusicItem,
): Extract<MusicLink, { status: "matched" }>["match"] | null {
  if (source.type !== candidate.type) return null;
  if (source.type === "track") {
    return source.isrc &&
      candidate.isrc &&
      source.isrc.toUpperCase() === candidate.isrc.toUpperCase()
      ? "isrc"
      : null;
  }
  if (
    source.upc &&
    candidate.upc &&
    source.upc.replace(/^0+/, "") === candidate.upc.replace(/^0+/, "")
  )
    return "upc";
  if (
    normalizeTitle(source.title) !== normalizeTitle(candidate.title) ||
    source.artists.map(normalizeTitle).sort().join(",") !==
      candidate.artists.map(normalizeTitle).sort().join(",") ||
    !source.tracks?.length ||
    source.tracks.length !== candidate.tracks?.length
  )
    return null;
  const matches = source.tracks.every((track, index) => {
    const other = candidate.tracks![index]!;
    if (track.isrc && other.isrc) return track.isrc.toUpperCase() === other.isrc.toUpperCase();
    return (
      normalizeTitle(track.title) === normalizeTitle(other.title) &&
      track.durationMs !== undefined &&
      other.durationMs !== undefined &&
      Math.abs(track.durationMs - other.durationMs) <= 2000 &&
      (track.explicit === undefined ||
        other.explicit === undefined ||
        track.explicit === other.explicit)
    );
  });
  return matches ? "tracklist" : null;
}
