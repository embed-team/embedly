import { parseMusicURL, type MusicItem, type MusicReference } from "./client";
import { request, UpstreamError } from "./http";
import { normalizeTitle } from "./match";

interface AppleResource {
  id: string;
  attributes: {
    name: string;
    artistName: string;
    url: string;
    artwork?: { url: string };
    releaseDate?: string;
    durationInMillis?: number;
    contentRating?: string;
    isrc?: string;
    upc?: string;
    albumName?: string;
  };
  relationships?: {
    albums?: ApplePage;
    artists?: ApplePage;
    tracks?: ApplePage;
  };
}

interface ApplePage {
  data: AppleResource[];
  next?: string;
  results?: { songs?: ApplePage; albums?: ApplePage };
}

export async function appleToken() {
  const response = await request("https://music.apple.com/us/new", {
    headers: { Accept: "text/html" },
  });
  let script: string | null = null;
  const rewritten = new HTMLRewriter()
    .on('script[src^="/assets/index"]', {
      element(element) {
        script = element.getAttribute("src");
      },
    })
    .transform(response);
  await rewritten.body!.pipeTo(new WritableStream());
  if (!script) throw new UpstreamError("Apple Music returned no web player script");
  const bundle = await request(new URL(script, "https://music.apple.com"));
  // Apple's anonymous web player ships its public catalog token in this bundle.
  const token = (await bundle.text())
    .match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)
    ?.find((token) => {
      // SAFETY: The matched JWT payload contains its expiration time in seconds.
      const payload = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString()) as {
        exp: number;
      };
      return payload.exp > Date.now() / 1000 + 60;
    });
  if (!token) throw new UpstreamError("Apple Music returned no valid catalog token");
  return token;
}

async function appleRequest(url: URL, token: string) {
  if (url.origin !== "https://amp-api.music.apple.com")
    throw new UpstreamError("Apple Music returned an invalid catalog URL");
  const response = await request(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: "https://music.apple.com",
      Referer: "https://music.apple.com/",
    },
  });
  // SAFETY: Apple's web catalog returns resources and relationships in data arrays.
  return (await response.json()) as ApplePage;
}

export async function readApple(ref: MusicReference, token: string): Promise<MusicItem> {
  const url = new URL(
    `https://amp-api.music.apple.com/v1/catalog/us/${ref.type === "track" ? "songs" : "albums"}/${ref.id}`,
  );
  url.searchParams.set("include", ref.type === "track" ? "artists,albums" : "artists,tracks");
  const page = await appleRequest(url, token);
  const resource = page.data[0];
  if (!resource) throw new UpstreamError("Apple Music did not return the requested item", 404);
  const artists = resource.relationships?.artists?.data;
  if (resource.id !== ref.id || !resource.attributes?.name || !artists?.length)
    throw new UpstreamError("Apple Music returned invalid music data");
  const attributes = resource.attributes;
  const album = resource.relationships?.albums?.data[0];
  const albumRef = album && parseMusicURL(album.attributes.url);
  if (album && (!albumRef || albumRef.provider !== "appleMusic" || albumRef.type !== "album"))
    throw new UpstreamError("Apple Music returned an invalid album URL");
  const tracks = [...(resource.relationships?.tracks?.data ?? [])];
  let next = resource.relationships?.tracks?.next;
  while (next) {
    const page = await appleRequest(new URL(next, url), token);
    tracks.push(...page.data);
    next = page.next;
  }
  if (ref.type === "album" && tracks.length === 0)
    throw new UpstreamError("Apple Music returned an incomplete tracklist");
  return {
    ...ref,
    title: attributes.name,
    artists: artists.map((artist) => artist.attributes.name),
    artwork: attributes.artwork?.url.replace("{w}", "640").replace("{h}", "640"),
    releaseDate: attributes.releaseDate,
    albumTitle: attributes.albumName,
    durationMs:
      ref.type === "track"
        ? attributes.durationInMillis
        : tracks.reduce((sum, track) => sum + (track.attributes.durationInMillis ?? 0), 0),
    explicit: attributes.contentRating === "explicit",
    isrc: attributes.isrc,
    upc: attributes.upc,
    album: albumRef ?? undefined,
    tracks:
      ref.type === "album"
        ? tracks.map((track) => ({
            id: track.id,
            url: track.attributes.url,
            title: track.attributes.name,
            durationMs: track.attributes.durationInMillis,
            isrc: track.attributes.isrc,
            explicit: track.attributes.contentRating === "explicit",
          }))
        : undefined,
  };
}

export async function searchApple(item: MusicItem, token: string) {
  const kind = item.type === "track" ? "songs" : "albums";
  const identifier = item.type === "track" ? item.isrc : item.upc;
  const url = new URL(
    `https://amp-api.music.apple.com/v1/catalog/us/${identifier ? kind : "search"}`,
  );
  if (identifier) {
    url.searchParams.set(item.type === "track" ? "filter[isrc]" : "filter[upc]", identifier);
  } else {
    url.search = new URLSearchParams({
      term: `${item.artists.join(" ")} ${item.title}`,
      types: kind,
      limit: "10",
    }).toString();
  }
  const page = await appleRequest(url, token);
  const results = identifier ? page.data : (page.results?.[kind]?.data ?? []);
  return results
    .filter(
      (result) =>
        identifier || normalizeTitle(result.attributes.name) === normalizeTitle(item.title),
    )
    .map((result) => {
      const ref = parseMusicURL(result.attributes.url);
      if (!ref || ref.provider !== "appleMusic" || ref.type !== item.type)
        throw new UpstreamError("Apple Music returned an invalid search URL");
      return ref;
    });
}
