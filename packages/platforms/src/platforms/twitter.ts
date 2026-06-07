import he from "he";

import { version } from "../../package.json";
import { Platform } from "../types";
import type { APITwitterStatus, FxTweetResponse, RawText } from "./twitter.d";

const MATCH_RE =
  /^(?:https?:\/\/)?(?:[\w-]+\.)*(?:twitter|x)\.com\/.*\/status(?:es)?\/(?<tweet_id>[^/?]+)/;
const MAX_CONTEXT_DEPTH = 1;

function enrichText(raw?: RawText) {
  if (!raw) return undefined;
  let text = raw.text;
  for (const facet of raw.facets) {
    if (facet.type === "url") {
      const source =
        facet.original && text.includes(facet.original) ? facet.original : facet.display;
      if (source && facet.replacement) {
        text = text.replace(source, facet.replacement);
      }
    }
    if (facet.type === "hashtag") {
      text = text.replace(
        `#${facet.original}`,
        `[#${facet.original}](https://x.com/hashtag/${facet.original})`,
      );
    }
    if (facet.type === "media") {
      text = text.replace(facet.original!, "");
    }
    if (facet.type === "mention") {
      text = text.replace(
        new RegExp(`@${facet.original}`, "i"),
        `[@${facet.original}](https://x.com/${facet.original})`,
      );
    }
  }
  return he.decode(text);
}

function resolveMediaUrl(media: { type: string; url?: string }) {
  if (media.type === "gif" && media.url?.startsWith("https://video.twimg.com/tweet_video/")) {
    return media.url
      .replace("https://video.twimg.com/", "https://gif.fxtwitter.com/")
      .replace(/\.mp4$/, ".gif");
  }

  return media.url ?? "";
}

type TwitterMeta = Pick<APITwitterStatus, "translation" | "article" | "poll"> & {
  community_note?: string;
};

export const Twitter: Platform<"Twitter", APITwitterStatus, TwitterMeta> = {
  type: "Twitter",
  async match(url) {
    const groups = url.match(MATCH_RE)?.groups;
    return groups?.tweet_id ?? null;
  },
  async fetch(id) {
    const resp = await fetch(`https://api.fxtwitter.com/2/status/${id}?lang=en`, {
      method: "GET",
      headers: {
        "User-Agent": `Embedly/${version}`,
      },
    });

    if (!resp.ok) {
      throw { code: resp.status, message: resp.statusText };
    }

    const { status, code } = (await resp.json()) as FxTweetResponse;

    if (code !== 200) {
      throw { code };
    }

    if (status?.type === "tombstone") {
      throw { code, status };
    }

    return status!;
  },
  async transform(raw, options) {
    const depth = options?.depth ?? 0;
    const includeContext = depth < MAX_CONTEXT_DEPTH;
    const text = raw.article?.preview_text ?? enrichText(raw.raw_text) ?? raw.text;
    const media = raw.article
      ? [{ url: raw.article.cover_media.media_info.original_img_url, type: "photo" }]
      : (raw.media?.all?.map((m) => ({
          url: resolveMediaUrl(m),
          type: m.type,
          description: "altText" in m && typeof m.altText === "string" ? m.altText : undefined,
        })) ?? []);

    return {
      platform: this.type,
      author: {
        name: raw.author.name,
        handle: raw.author.screen_name,
        url: `https://x.com/${raw.author.screen_name}`,
        avatar: raw.author.avatar_url ?? "",
      },
      url: raw.url,
      text,
      timestamp: raw.created_timestamp,
      stats: {
        comments: raw.replies,
        reposts: raw.reposts,
        likes: raw.likes,
        views: raw.views ?? undefined,
        bookmarks: raw.bookmarks ?? undefined,
      },
      media,
      quote:
        includeContext && raw.quote?.type === "status"
          ? await this.transform(raw.quote, { depth: depth + 1 })
          : undefined,
      reply_to:
        includeContext && raw.replying_to
          ? await this.transform(await this.fetch(raw.replying_to.status), { depth: depth + 1 })
          : undefined,

      article: raw.article,
      community_note: enrichText(raw.community_note),
      poll: raw.poll,
      translation: raw.article ? undefined : raw.translation,
    };
  },
} as const;
