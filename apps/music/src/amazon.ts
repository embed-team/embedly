import { parseMusicURL, type MusicItem, type MusicReference } from "./client";
import { durationMs, readScripts, request, UpstreamError } from "./http";

interface AmazonMusicData {
  "@type": string;
  name: string;
  url: string;
  byArtist: { name: string } | { name: string }[];
  image?: string;
  datePublished?: string;
  duration?: string;
  timeRequired?: string;
  isrcCode?: string;
  inAlbum?: { url: string; name: string };
  track?: {
    name: string;
    url: string;
    duration: string;
    isFamilyFriendly?: boolean;
  }[];
}

export async function readAmazon(ref: MusicReference): Promise<MusicItem> {
  const scripts = await readScripts(ref.url, 'script[type="application/ld+json"]', "Googlebot");
  // SAFETY: Amazon's crawler representation exposes schema.org MusicAlbum and MusicRecording objects.
  const data = scripts
    .map((script) => JSON.parse(script) as AmazonMusicData)
    .find((item) => item["@type"] === (ref.type === "album" ? "MusicAlbum" : "MusicRecording"));
  if (!data?.name || !data.byArtist)
    throw new UpstreamError("Amazon Music returned invalid music data");
  const artists = Array.isArray(data.byArtist) ? data.byArtist : [data.byArtist];
  const album = data.inAlbum ? parseMusicURL(data.inAlbum.url) : null;
  const tracks = await Promise.all(
    (data.track ?? []).map(async (track) => {
      const ref = parseMusicURL(track.url);
      if (!ref || ref.provider !== "amazonMusic" || ref.type !== "track")
        throw new UpstreamError("Amazon Music returned an invalid track URL");
      const item = await readAmazon(ref);
      return {
        id: item.id,
        url: item.url,
        title: item.title,
        durationMs: item.durationMs,
        isrc: item.isrc,
        explicit: track.isFamilyFriendly === undefined ? undefined : !track.isFamilyFriendly,
      };
    }),
  );
  return {
    ...ref,
    title: data.name,
    artists: artists.map((artist) => artist.name),
    artwork: data.image,
    releaseDate: data.datePublished?.slice(0, 10),
    durationMs:
      data.duration || data.timeRequired
        ? durationMs((data.duration ?? data.timeRequired)!)
        : undefined,
    isrc: data.isrcCode,
    albumTitle: data.inAlbum?.name,
    album: album ?? undefined,
    tracks: data.track ? tracks : undefined,
  };
}

export async function searchAmazon(item: MusicItem) {
  const response = await request(
    "https://music.amazon.com/config.json?skipToken=true&clientApplication=skyfire",
    { method: "POST" },
  );
  // SAFETY: Amazon's anonymous web bootstrap provides the device and CSRF metadata for this guest session.
  const config = (await response.json()) as {
    deviceId: string;
    sessionId: string;
    version: string;
    csrf: { token: string; ts: number; rnd: string };
  };
  const query = `${item.title} ${item.artists.join(" ")}`;
  // Anonymous web searches use an empty client token and a fresh CSRF session.
  const headers = {
    "x-amzn-authentication": JSON.stringify({
      interface: "ClientAuthenticationInterface.v1_0.ClientTokenElement",
      accessToken: "",
    }),
    "x-amzn-device-model": "WEBPLAYER",
    "x-amzn-device-width": "1920",
    "x-amzn-device-height": "1080",
    "x-amzn-device-family": "WebPlayer",
    "x-amzn-device-id": config.deviceId,
    "x-amzn-session-id": config.sessionId,
    "x-amzn-device-language": "en_US",
    "x-amzn-music-domain": "music.amazon.com",
    "x-amzn-user-agent": "Mozilla/5.0",
    "x-amzn-application-version": String(config.version),
    "x-amzn-device-time-zone": "UTC",
    "x-amzn-request-id": crypto.randomUUID(),
    "x-amzn-timestamp": String(Date.now()),
    "x-amzn-currency-of-preference": "USD",
    "x-amzn-os-version": "1.0",
    "x-amzn-referer": "music.amazon.com",
    "x-amzn-affiliate-tags": "",
    "x-amzn-ref-marker": "",
    "x-amzn-page-url": "https://music.amazon.com/search",
    "x-amzn-weblab-id-overrides": "",
    "x-amzn-video-player-token": "",
    "x-amzn-feature-flags": "",
    "x-amzn-has-profile-id": "",
    "x-amzn-age-band": "",
    "x-amzn-csrf": JSON.stringify({
      interface: "CSRFInterface.v1_0.CSRFHeaderElement",
      token: String(config.csrf.token),
      timestamp: String(config.csrf.ts),
      rndNonce: String(config.csrf.rnd),
    }),
  };
  const results = await request("https://na.web.skill.music.a2z.com/api/showSearch", {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify({
      keyword: JSON.stringify({
        interface:
          "Web.TemplatesInterface.v1_0.Touch.SearchTemplateInterface.SearchKeywordClientInformation",
        keyword: query,
      }),
      userHash: "",
      headers: JSON.stringify(headers),
    }),
  });
  const templates = JSON.stringify(await results.json());
  const refs = new Map<string, MusicReference>();
  // Navigation URLs occur inside both JSON objects and JSON-encoded template strings.
  for (const match of templates.matchAll(/\/(albums|tracks)\/[A-Z0-9]{10}(?:\?[^"\\\s]*)?/g)) {
    const ref = parseMusicURL(`https://music.amazon.com${match[0]}`);
    if (ref?.provider === "amazonMusic" && ref.type === item.type) refs.set(ref.id, ref);
  }
  return [...refs.values()];
}
