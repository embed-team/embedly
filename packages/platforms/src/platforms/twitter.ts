import he from "he";

import { version } from "../../package.json";
import { Platform } from "../types";
import type { APITwitterStatus, FxTweetResponse, RawText } from "./twitter.d";

const MATCH_RE =
  /^(?:https?:\/\/)?(?:[\w-]+\.)*(?:twitter|x)\.com\/.*\/status(?:es)?\/(?<tweet_id>[^/?]+)/;

function enrichText(raw?: RawText) {
  if (!raw) return undefined;
  let text = raw.text;
  for (const facet of raw.facets) {
    if (facet.type === "url") {
      text = text.replace(facet.original!, facet.replacement!);
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
    if (facet.type === "url") {
      text = text.replace(facet.display!, facet.replacement!);
    }
  }
  return he.decode(text);
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
  async transform(raw) {
    return {
      platform: this.type,
      author: {
        name: raw.author.name,
        handle: raw.author.screen_name,
        url: `https://x.com/${raw.author.screen_name}`,
        avatar: raw.author.avatar_url ?? "",
      },
      url: raw.url,
      text: enrichText(raw.raw_text) ?? raw.text,
      timestamp: raw.created_timestamp,
      stats: {
        comments: raw.replies,
        reposts: raw.reposts,
        likes: raw.likes,
        views: raw.views ?? undefined,
        bookmarks: raw.bookmarks ?? undefined,
      },
      media: raw.media?.all?.map((m) => ({ url: m.url ?? "", type: m.type })) ?? [],
      quote: raw.quote?.type === "status" ? await this.transform(raw.quote) : undefined,
      reply_to: raw.replying_to
        ? await this.transform(await this.fetch(raw.replying_to.status))
        : undefined,

      article: raw.article,
      community_note: enrichText(raw.community_note),
      poll: raw.poll,
      translation: raw.translation,
    };
  },
} as const;
