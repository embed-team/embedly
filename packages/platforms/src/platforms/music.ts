import type { Platform } from "../types";

interface MusicHTMLRewriter {
  on(selector: string, handlers: { text(chunk: { text: string }): void }): MusicHTMLRewriter;
  transform(response: Response): Response;
}

declare const HTMLRewriter: { new (): MusicHTMLRewriter };

interface MusicData {
  pageUrl: string;
  entityUniqueId: string;
  entityData: {
    type: "song" | "album";
    title: string;
    artistName: string;
    thumbnailUrl: string;
    duration?: number;
    isrc?: string;
    releaseDate: { year: number; month?: number; day?: number };
  };
  sections: {
    sectionId: string;
    show: boolean;
    links?: {
      displayName: string;
      platform: string;
      uniqueId?: string;
      url?: string;
      show: boolean;
    }[];
  }[];
}

interface MusicMeta {
  links: { name: string; url: string }[];
}

const MATCH_RE =
  /^(?:spotify:(?:track|album):[0-9a-zA-Z]{22}|https?:\/\/(?:(?:open|play)\.spotify\.com\/(?:intl-[a-z]+\/)?(?:embed\/)?(?:track|album)\/[0-9a-zA-Z]{22}|(?:music|geo\.music)\.apple\.com\/[^/?#]+\/(?:album|song)\/[^?#]+|(?:www\.|listen\.)?tidal\.com\/(?:browse\/)?(?:track|album)\/\d+))(?:[/?#]|$)/i;

async function fetchPage(url: string, userAgent: string) {
  const response = await fetch(url, {
    headers: { "User-Agent": userAgent, Accept: "text/html" },
  });
  if (!response.ok) throw { code: response.status, message: response.statusText };
  let data = "";
  const rewritten = new HTMLRewriter()
    .on("script#__NEXT_DATA__", {
      text(chunk) {
        data += chunk.text;
      },
    })
    .transform(response);
  await rewritten.body!.pipeTo(new WritableStream());
  if (!data) throw { code: 502, message: "Odesli returned no music data" };
  // SAFETY: Songlink embeds its server-rendered page data in Next.js hydration JSON.
  const raw = JSON.parse(data) as { props: { pageProps: { pageData: MusicData } } };
  const page = raw.props?.pageProps?.pageData;
  if (!page?.entityData?.title || !page.entityData.artistName || !Array.isArray(page.sections)) {
    throw { code: 502, message: "Odesli returned invalid music data" };
  }
  return page;
}

export const Music: Platform<"Music", MusicData[], MusicMeta> = {
  type: "Music",
  async match(url) {
    return MATCH_RE.test(url) ? url : null;
  },
  async fetch(id, env) {
    if (!MATCH_RE.test(id)) throw { code: 400, message: "Invalid music URL" };

    const resolveURL = new URL("https://api.odesli.co/resolve");
    resolveURL.searchParams.set("url", id);
    const resolution = await fetch(resolveURL, {
      headers: { "User-Agent": env!.EMBED_USER_AGENT, Accept: "application/json" },
    });
    if (!resolution.ok) throw { code: resolution.status, message: resolution.statusText };
    // SAFETY: Odesli's resolver returns the provider, entity type, ID and optional country.
    const resolved = (await resolution.json()) as {
      provider: string;
      type: string;
      id: string;
      country?: string;
    };
    const provider = { spotify: "s", itunes: "i", tidal: "t" };
    if (
      !Object.hasOwn(provider, resolved.provider) ||
      !["song", "album"].includes(resolved.type) ||
      !/^[a-zA-Z0-9]+$/.test(resolved.id) ||
      (resolved.country && !/^[a-zA-Z]{2}$/.test(resolved.country))
    ) {
      throw { code: 502, message: "Odesli returned an invalid music resolution" };
    }
    const country =
      resolved.provider === "itunes" && resolved.country
        ? `${resolved.country.toLowerCase()}/`
        : "";
    // SAFETY: The provider was checked against the supported provider keys above.
    const prefix = provider[resolved.provider as keyof typeof provider];
    const pageURL = `https://${resolved.type === "album" ? "album" : "song"}.link/${country}${prefix}/${resolved.id}`;
    const page = await fetchPage(pageURL, env!.EMBED_USER_AGENT);
    const pages = [page];
    const entity = page.entityData;
    const domain = resolved.type === "album" ? "album" : "song";
    for (const platform of ["spotify", "appleMusic"]) {
      const links = pages.flatMap((item) =>
        item.sections.flatMap((section) => section.links ?? []),
      );
      if (links.some((link) => link.platform === platform && link.url && link.show !== false)) {
        continue;
      }
      const searchURL = new URL(
        platform === "spotify"
          ? "https://api.odesli.co/search-results"
          : "https://itunes.apple.com/search",
      );
      let candidates: { id: string; title: string; artistName: string; duration?: number }[];
      if (platform === "spotify") {
        searchURL.search = new URLSearchParams({
          providers: "spotify",
          query: entity.isrc ? `isrc:${entity.isrc}` : `${entity.artistName} ${entity.title}`,
          type: resolved.type,
          userCountry: "US",
        }).toString();
        const response = await fetch(searchURL, {
          headers: { "User-Agent": env!.EMBED_USER_AGENT, Accept: "application/json" },
        });
        if (!response.ok) throw { code: response.status, message: response.statusText };
        // SAFETY: Odesli's search returns Spotify entities with the same metadata as its pages.
        const results = (await response.json()) as { spotify: typeof candidates };
        candidates = results.spotify;
      } else {
        searchURL.search = new URLSearchParams({
          term: `${entity.artistName} ${entity.title}`,
          entity: resolved.type === "album" ? "album" : "song",
          country: "US",
          limit: "10",
        }).toString();
        const response = await fetch(searchURL, {
          headers: { "User-Agent": env!.EMBED_USER_AGENT, Accept: "application/json" },
        });
        if (!response.ok) throw { code: response.status, message: response.statusText };
        // SAFETY: Apple's search returns song or album metadata for the requested entity type.
        const results = (await response.json()) as {
          results: {
            trackId?: number;
            trackName?: string;
            trackTimeMillis?: number;
            collectionId: number;
            collectionName: string;
            artistName: string;
          }[];
        };
        candidates = results.results.map((item) => ({
          id: String(resolved.type === "album" ? item.collectionId : item.trackId),
          title: resolved.type === "album" ? item.collectionName : item.trackName!,
          artistName: item.artistName,
          duration: item.trackTimeMillis,
        }));
      }
      const identities = new Set([
        ...pages.map((item) => item.entityUniqueId),
        ...links.map((link) => link.uniqueId).filter(Boolean),
      ]);
      for (const candidate of candidates) {
        if (
          candidate.title.toLowerCase() !== entity.title.toLowerCase() ||
          candidate.artistName.toLowerCase() !== entity.artistName.toLowerCase() ||
          (candidate.duration &&
            entity.duration &&
            Math.abs(candidate.duration - entity.duration) > 2000)
        ) {
          continue;
        }
        const match = await fetchPage(
          `https://${domain}.link/${platform === "spotify" ? "s" : "us/i"}/${candidate.id}`,
          env!.EMBED_USER_AGENT,
        );
        if (
          (entity.isrc && match.entityData.isrc === entity.isrc) ||
          identities.has(match.entityUniqueId) ||
          match.sections.some((section) =>
            section.links?.some((link) => link.uniqueId && identities.has(link.uniqueId)),
          )
        ) {
          pages.push(match);
          break;
        }
      }
    }
    return pages;
  },
  async transform(raw) {
    const entity = raw[0]!.entityData;
    const date = entity.releaseDate;
    const links = new Map(
      raw
        .flatMap((page) => page.sections)
        .filter(
          (section) => section.show !== false && section.sectionId === "section|auto|links|listen",
        )
        .flatMap((section) => section.links ?? [])
        .flatMap((link) =>
          link.show !== false && link.url?.startsWith("https://")
            ? [[link.platform, { name: link.displayName, url: link.url }] as const]
            : [],
        ),
    );
    return {
      platform: this.type,
      author: { name: entity.artistName, avatar: entity.thumbnailUrl },
      text: entity.title,
      url: raw[0]!.pageUrl,
      timestamp: Date.UTC(date.year, (date.month ?? 1) - 1, date.day ?? 1) / 1000,
      media: [],
      links: ["spotify", "appleMusic", "tidal", "amazonMusic"].flatMap((platform) => {
        const link = links.get(platform);
        return link ? [link] : [];
      }),
    };
  },
};
