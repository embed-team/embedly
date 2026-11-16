export type MusicProvider = "spotify" | "appleMusic" | "tidal" | "amazonMusic";
export type MusicType = "track" | "album";

export interface MusicReference {
  provider: MusicProvider;
  type: MusicType;
  id: string;
  url: string;
}

export interface MusicTrack {
  id: string;
  url: string;
  title: string;
  durationMs?: number;
  isrc?: string;
  explicit?: boolean;
}

export interface MusicItem extends MusicReference {
  title: string;
  artists: string[];
  artwork?: string;
  releaseDate?: string;
  durationMs?: number;
  isrc?: string;
  upc?: string;
  explicit?: boolean;
  tracks?: MusicTrack[];
  album?: MusicReference;
  albumTitle?: string;
}

export type MusicLink =
  | {
      status: "matched";
      id: string;
      url: string;
      match: "source" | "isrc" | "upc" | "tracklist";
    }
  | { status: "not_found" | "unavailable"; reason: string };

export interface MusicLinks {
  source: MusicReference;
  item: MusicItem;
  links: Record<MusicProvider, MusicLink>;
}

export function parseMusicURL(input: string): MusicReference | null {
  if (/^spotify:(track|album):[a-zA-Z0-9]{22}$/.test(input)) {
    input = input.replace(/^spotify:(track|album):/, "https://open.spotify.com/$1/");
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;

  if (["open.spotify.com", "play.spotify.com"].includes(url.hostname)) {
    const match = url.pathname.match(
      /^\/(?:intl-[a-z]+\/)?(?:embed\/)?(track|album)\/([a-zA-Z0-9]{22})\/?$/,
    );
    if (!match) return null;
    return {
      provider: "spotify",
      type: match[1] === "album" ? "album" : "track",
      id: match[2]!,
      url: `https://open.spotify.com/${match[1]}/${match[2]}`,
    };
  }
  if (["music.apple.com", "geo.music.apple.com"].includes(url.hostname)) {
    const match = url.pathname.match(/^\/([a-z]{2})\/(album|song)\/(?:[^/]+\/)?(\d+)\/?$/i);
    if (!match) return null;
    const track = url.searchParams.get("i");
    if (track && !/^\d+$/.test(track)) return null;
    return {
      provider: "appleMusic",
      type: track || match[2] === "song" ? "track" : "album",
      id: track ?? match[3]!,
      url: `https://music.apple.com/us/${match[2]}/_/${match[3]}${track ? `?i=${track}` : ""}`,
    };
  }
  if (["tidal.com", "www.tidal.com", "listen.tidal.com"].includes(url.hostname)) {
    const match = url.pathname.match(/^\/(?:browse\/)?(track|album)\/(?:[^/]+\/)?(\d+)\/?$/);
    if (!match) return null;
    return {
      provider: "tidal",
      type: match[1] === "album" ? "album" : "track",
      id: match[2]!,
      url: `https://tidal.com/browse/${match[1]}/${match[2]}`,
    };
  }
  if (url.hostname === "music.amazon.com") {
    const match = url.pathname.match(/^\/(albums|tracks)\/([A-Z0-9]{10})\/?$/);
    if (!match) return null;
    const track = url.searchParams.get("trackAsin");
    if (track && !/^[A-Z0-9]{10}$/.test(track)) return null;
    return {
      provider: "amazonMusic",
      type: track || match[1] === "tracks" ? "track" : "album",
      id: track ?? match[2]!,
      url: `https://music.amazon.com/${track ? "tracks" : match[1]}/${track ?? match[2]}`,
    };
  }
  return null;
}
