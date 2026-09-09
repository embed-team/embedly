import he from "he";

import type { Platform } from "../types";
import type { TruthSocialStatus } from "./truth-social.d";

const MATCH_RE =
  /^(?:https?:\/\/)?(?:www\.)?truthsocial\.com\/@[^/?]+\/(?:posts\/)?(\d+)\/?(?:[?#].*)?$/;
const MAX_CONTEXT_DEPTH = 1;

function stripHtml(html: string) {
  return he.decode(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p>/gi, "\n\n")
      .replace(/<[^>]+>/g, ""),
  );
}

export const TruthSocial: Platform<"TruthSocial", TruthSocialStatus, {}> = {
  type: "TruthSocial",
  async match(url) {
    return url.match(MATCH_RE)?.[1] ?? null;
  },
  async fetch(id, env) {
    if (!/^\d+$/.test(id)) {
      throw { code: 400, message: "Invalid Truth Social status ID" };
    }
    if (!env?.TRUTH_SOCIAL_ACCESS_TOKEN) {
      throw { code: 500, message: "TRUTH_SOCIAL_ACCESS_TOKEN is required" };
    }

    const response = await fetch(`https://truthsocial.com/api/v1/statuses/${id}`, {
      headers: {
        Authorization: `Bearer ${env.TRUTH_SOCIAL_ACCESS_TOKEN}`,
        Accept: "application/json",
        "User-Agent": env.EMBED_USER_AGENT,
      },
    });

    if (!response.ok) throw { code: response.status, message: response.statusText };

    // SAFETY: Truth Social's status endpoint follows its observed Mastodon-compatible shape.
    return (await response.json()) as TruthSocialStatus;
  },
  async transform(raw, options) {
    const depth = options?.depth ?? 0;
    const includeContext = depth < MAX_CONTEXT_DEPTH;
    const text = stripHtml(raw.content);

    return {
      platform: this.type,
      author: {
        name: raw.account.display_name,
        handle: raw.account.username,
        url: raw.account.url,
        avatar: raw.account.avatar,
      },
      url: raw.url,
      text: text || undefined,
      timestamp: Math.floor(Date.parse(raw.created_at) / 1000),
      stats: {
        comments: raw.replies_count,
        reposts: raw.reblogs_count,
        likes: raw.favourites_count,
      },
      media: raw.media_attachments.map((media) => ({
        url: media.url,
        type: media.type,
        description: media.description,
      })),
      quote:
        includeContext && raw.quote
          ? await this.transform(raw.quote, { depth: depth + 1 })
          : undefined,
      reply_to:
        includeContext && raw.in_reply_to
          ? await this.transform(raw.in_reply_to, { depth: depth + 1 })
          : undefined,
    };
  },
} as const;
