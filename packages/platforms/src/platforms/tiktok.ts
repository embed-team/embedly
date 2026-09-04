import { NormalizedPost, Platform } from "../types";
import type { TikTokItem, TikTokPlayerResponse } from "./tiktok.d";

const MATCH_RE = /^(?:https?:\/\/)?(?:[\w-]+\.)*tiktok\.com(?:\/|$)/;

const FOLLOWUP_RE =
  /^https:\/\/(?:m|www|vm)?\.?tiktok\.com\/(?<tiktok_user>@(?:[\w.-]+)?)\/(?<tiktok_type>video|photo)\/(?<tiktok_id>\d+)/;

function parseMedia(raw: TikTokItem): NormalizedPost["media"] {
  if (raw.image_post_info) {
    return raw.image_post_info.images.flatMap((image) => {
      const url = image.display_image?.url_list?.[0];
      return url ? [{ url, type: "image" }] : [];
    });
  }

  const urls = raw.video_info?.url_list ?? [];
  const videoURL = urls.find((url: string) => url.includes("/aweme/v1/play/")) ?? urls[0];
  return videoURL ? [{ url: videoURL, type: "video" }] : [];
}

export const TikTok: Platform<"TikTok", TikTokItem, {}> = {
  type: "TikTok",
  async match(url, env) {
    const match = url.match(MATCH_RE);
    if (!match) return null;
    const req = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": env?.EMBED_USER_AGENT ?? "curl/8.7.1",
      },
    });

    const groups = req.url.match(FOLLOWUP_RE)?.groups;
    if (!groups) return null;
    const { tiktok_user, tiktok_type, tiktok_id } = groups;
    return `${tiktok_user}/${tiktok_type}/${tiktok_id}`;
  },
  async fetch(id, env) {
    const tiktok_id = id.split("/")[2];
    const url = new URL("https://www.tiktok.com/player/api/v1/items");
    url.searchParams.set("item_ids", tiktok_id);
    url.searchParams.set("language", "en-US");
    url.searchParams.set("aid", "1459");
    url.searchParams.set("data_source", "pack");

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": env?.EMBED_USER_AGENT ?? "curl/8.7.1",
      },
    });
    if (!resp.ok) {
      throw { code: resp.status, message: resp.statusText };
    }

    // SAFETY: TikTok player payload is checked against live video, photo, and error responses.
    const data = (await resp.json()) as TikTokPlayerResponse;
    const item = data.items?.find((item) => item.id_str === tiktok_id);
    if (!item) {
      const result = data.results?.find((result) => result.id_str === tiktok_id);
      throw {
        code: 500,
        message: result?.code ?? "TikTok player API returned no item data",
      };
    }
    return item;
  },
  async transform(raw) {
    const id = raw.id_str;
    const handle = raw.author_info.unique_id;
    const type = raw.image_post_info ? "photo" : "video";
    return {
      platform: this.type,
      author: {
        name: raw.author_info.nickname,
        avatar: raw.author_info.avatar_url_list[0],
        handle,
        url: `https://tiktok.com/@${handle}`,
      },
      timestamp: raw.create_time ?? Number(BigInt(id) >> 32n),
      url: `https://tiktok.com/@${handle}/${type}/${id}`,
      text: raw.desc,
      media: parseMedia(raw),
      stats: {
        comments: raw.statistics_info.comment_count,
        reposts: raw.statistics_info.share_count,
        likes: raw.statistics_info.digg_count,
      },
    };
  },
} as const;
