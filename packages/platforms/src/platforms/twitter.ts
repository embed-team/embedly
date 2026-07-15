import he from "he";

import { version } from "../../package.json";
import { Platform } from "../types";
import type { APITwitterStatus, FxTweetResponse, RawText } from "./twitter.d";

const MATCH_RE =
  /^(?:https?:\/\/)?(?:[\w-]+\.)*(?:twitter|x)\.com\/.*\/status(?:es)?\/(?<tweet_id>[^/?]+)/;
const MAX_CONTEXT_DEPTH = 1;

const RENDERED_FACET_TYPES = ["url", "hashtag", "media", "mention"];

function enrichText(raw?: RawText) {
  if (!raw) return undefined;
  const offsets = getTextOffsets(raw);
  const displayStart = offsets.index(raw.display_text_range[0]);
  const displayEnd = offsets.index(raw.display_text_range[1]);
  let rendered = "";
  let index = displayStart;

  for (const facet of raw.facets.toSorted((a, b) => a.indices[0] - b.indices[0])) {
    const start = offsets.index(facet.indices[0]);
    const end = offsets.index(facet.indices[1]);
    if (start < index || end <= start) continue;
    if (start < displayStart || displayEnd < end) continue;

    rendered += raw.text.slice(index, start);
    index = end;

    if (facet.type === "url") {
      rendered += renderUrlFacet(facet, raw.text.slice(start, end));
    }
    if (facet.type === "hashtag") {
      rendered += renderHashtagFacet(facet, raw.text.slice(start, end));
    }
    if (facet.type === "media") {
      continue;
    }
    if (facet.type === "mention") {
      rendered += renderMentionFacet(facet, raw.text.slice(start, end));
    }

    if (!RENDERED_FACET_TYPES.includes(facet.type)) {
      rendered += raw.text.slice(start, end);
    }
  }

  return he.decode(rendered + raw.text.slice(index, displayEnd));
}

function getTextOffsets(raw: RawText) {
  const codePointMap = getCodePointMap(raw.text);
  const directOffsets = {
    index(offset: number) {
      return clamp(offset, 0, raw.text.length);
    },
  };
  const codePointOffsets = {
    index(offset: number) {
      return codePointMap[clamp(offset, 0, codePointMap.length - 1)] ?? raw.text.length;
    },
  };

  if (scoreOffsets(raw, directOffsets) >= scoreOffsets(raw, codePointOffsets)) {
    return directOffsets;
  }

  return codePointOffsets;
}

function getCodePointMap(text: string) {
  const indices = [];
  let index = 0;

  for (const char of text) {
    indices.push(index);
    index += char.length;
  }

  indices.push(text.length);
  return indices;
}

function scoreOffsets(raw: RawText, offsets: { index(offset: number): number }) {
  let score = 0;

  for (const facet of raw.facets) {
    const start = offsets.index(facet.indices[0]);
    const end = offsets.index(facet.indices[1]);
    const text = raw.text.slice(start, end);

    if (end <= start) score -= 1;
    if (facet.type === "hashtag" && text === `#${facet.original}`) score += 3;
    if (facet.type === "mention" && text === `@${facet.original}`) score += 3;
    if (facet.type === "url" && /^https?:\/\//.test(text)) score += 2;
    if (facet.type === "media" && /^https?:\/\//.test(text)) score += 2;
  }

  return score;
}

function renderUrlFacet(facet: RawText["facets"][number], text: string) {
  if (facet.replacement) return facet.replacement;
  if (!facet.display) return text;
  return `[${facet.display}](${text})`;
}

function renderHashtagFacet(facet: RawText["facets"][number], text: string) {
  const tag = facet.original ?? text.replace(/^#/, "");
  return `[#${tag}](https://x.com/hashtag/${tag})`;
}

function renderMentionFacet(facet: RawText["facets"][number], text: string) {
  const handle = facet.original ?? text.replace(/^@/, "");
  return `[@${handle}](https://x.com/${handle})`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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
