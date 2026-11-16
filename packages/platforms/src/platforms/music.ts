import { parseMusicURL, type MusicLinks } from "@embedly/music/client";

import type { Platform } from "../types";

interface MusicMeta {
  links: { name: string; url: string }[];
}

export const Music: Platform<"Music", MusicLinks, MusicMeta> = {
  type: "Music",
  async match(url) {
    return parseMusicURL(url)?.url ?? null;
  },
  async fetch(id, env) {
    const url = new URL("https://music.embeds.media/v1/links");
    url.searchParams.set("url", id);
    const response = await env!.MUSIC_FETCH(url);
    if (!response.ok) throw { code: response.status, message: "Music lookup failed" };
    // SAFETY: The bound music Worker returns its shared MusicLinks contract.
    return (await response.json()) as MusicLinks;
  },
  async transform(raw) {
    const item = raw.item;
    return {
      platform: this.type,
      author: { name: item.artists.join(", "), avatar: item.artwork ?? "" },
      text: item.title,
      url: raw.source.url,
      timestamp: item.releaseDate ? Math.floor(Date.parse(item.releaseDate) / 1000) : 0,
      media: [],
      links: (
        [
          ["spotify", "Spotify"],
          ["appleMusic", "Apple Music"],
          ["tidal", "TIDAL"],
          ["amazonMusic", "Amazon Music"],
        ] as const
      ).flatMap(([provider, name]) => {
        const link = raw.links[provider];
        return link.status === "matched" ? [{ name, url: link.url }] : [];
      }),
    };
  },
};
