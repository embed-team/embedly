import { parseMusicURL, type MusicItem, type MusicReference } from "./client";
import { readScripts, UpstreamError } from "./http";
import { normalizeTitle } from "./match";

interface AppleDescriptor {
  kind: string;
  identifiers: { storeAdamID: string };
  url: string;
}

interface AppleItem {
  title?: string;
  titleLinks?: { title: string }[];
  subtitleLinks?: { title: string }[];
  artistName?: string;
  duration?: number;
  showExplicitBadge?: boolean;
  contentDescriptor?: AppleDescriptor;
  artwork?: { dictionary: { url: string } };
}

interface ApplePage {
  data?: { data: { sections: { itemKind: string; items: AppleItem[] }[] } }[];
  datePublished?: string;
}

export async function readApple(ref: MusicReference): Promise<MusicItem> {
  const scripts = await readScripts(
    ref.url,
    'script#serialized-server-data, script[type="application/ld+json"]',
  );
  // SAFETY: The selected Apple scripts contain page sections or schema.org release metadata.
  const pages = scripts.map((script) => JSON.parse(script) as ApplePage);
  const sections = pages.find((page) => page.data)?.data?.[0]?.data.sections;
  const releaseDate = pages.find((page) => page.datePublished)?.datePublished;
  const song = sections?.find((section) => section.itemKind === "songDetailHeader")?.items[0]
    ?.contentDescriptor;
  if (song) {
    const albumTrack = parseMusicURL(song.url);
    if (
      !albumTrack ||
      albumTrack.provider !== "appleMusic" ||
      albumTrack.type !== "track" ||
      albumTrack.id !== ref.id ||
      !new URL(albumTrack.url).pathname.includes("/album/")
    ) {
      throw new UpstreamError("Apple Music returned an invalid song URL");
    }
    return readApple(albumTrack);
  }
  const header = sections?.find((section) => section.itemKind === "containerDetailHeaderLockup")
    ?.items[0];
  const tracks =
    sections
      ?.filter((section) => section.itemKind === "trackLockup")
      .flatMap((section) => section.items) ?? [];
  if (!header?.title || !header.contentDescriptor || tracks.length === 0) {
    throw new UpstreamError("Apple Music returned incomplete album data");
  }
  const artwork = header.artwork?.dictionary.url
    .replace("{w}", "640")
    .replace("{h}", "640")
    .replace("{f}", "jpg");
  const artists = header.subtitleLinks?.map((link) => link.title) ?? [];
  const albumRef = parseMusicURL(header.contentDescriptor.url);
  if (!albumRef || albumRef.type !== "album")
    throw new UpstreamError("Apple Music returned an invalid album URL");
  if (ref.type === "track") {
    const track = tracks.find((item) => item.contentDescriptor?.identifiers.storeAdamID === ref.id);
    if (!track?.title)
      throw new UpstreamError("Apple Music did not return the requested track", 404);
    return {
      ...ref,
      title: track.title,
      artists: track.artistName ? [track.artistName] : artists,
      artwork,
      releaseDate,
      albumTitle: header.title,
      durationMs: track.duration,
      explicit: track.showExplicitBadge,
      album: albumRef,
    };
  }
  return {
    ...ref,
    title: header.title,
    artists,
    artwork,
    releaseDate,
    durationMs: tracks.reduce((sum, track) => sum + (track.duration ?? 0), 0),
    tracks: tracks.map((track) => ({
      id: track.contentDescriptor!.identifiers.storeAdamID,
      url: track.contentDescriptor!.url,
      title: track.title!,
      durationMs: track.duration,
      explicit: track.showExplicitBadge,
    })),
  };
}

export async function searchApple(item: MusicItem) {
  const url = new URL("https://music.apple.com/us/search");
  url.searchParams.set("term", `${item.artists.join(" ")} ${item.title}`);
  const scripts = await readScripts(url.href, "script#serialized-server-data");
  // SAFETY: Apple's public search uses the same serialized section and content descriptor shape as album pages.
  const page = JSON.parse(scripts[0]!) as ApplePage;
  const refs = new Map<string, MusicReference>();
  for (const section of page.data?.[0]?.data.sections ?? []) {
    for (const result of section.items) {
      if (!result.contentDescriptor) continue;
      const title = result.title ?? result.titleLinks?.[0]?.title;
      if (!title || normalizeTitle(title) !== normalizeTitle(item.title)) continue;
      const ref = parseMusicURL(result.contentDescriptor.url);
      if (ref?.provider === "appleMusic" && ref.type === item.type) refs.set(ref.id, ref);
    }
  }
  return [...refs.values()];
}
