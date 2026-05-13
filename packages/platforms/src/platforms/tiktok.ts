import * as cheerio from "cheerio";

import { NormalizedPost, Platform } from "../types";

const MATCH_RE = /^(?:https?:\/\/)?(?:[\w-]+\.)*tiktok\.com(?:\/|$)/;

const FOLLOWUP_RE =
  /^https:\/\/(?:m|www|vm)?\.?tiktok\.com\/(?<tiktok_user>@(?:[\w.-]+)?)\/(?<tiktok_type>video|photo)\/(?<tiktok_id>\d+)/;

async function parseMedia(raw: Record<string, any>): Promise<NormalizedPost["media"]> {
  if (raw.video) {
    const videoURL = raw.video.PlayAddrStruct.UrlList[2];
    const video = await fetch(videoURL, {
      method: "GET",
      redirect: "follow",
    });
    return [{ url: video.url, type: "video" }];
  }
  return [];
}

export const TikTok: Platform<"TikTok", Record<string, any>, {}> = {
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

    console.log(req.url);

    const groups = req.url.match(FOLLOWUP_RE)?.groups;
    if (!groups) return null;
    console.log(groups);
    const { tiktok_user, tiktok_type, tiktok_id } = groups;
    return `${tiktok_user}/${tiktok_type}/${tiktok_id}`;
  },
  async fetch(id, env) {
    const [tiktok_user, tiktok_type, tiktok_id] = id.split("/");
    const resp = await fetch(`https://www.tiktok.com/${tiktok_user}/${tiktok_type}/${tiktok_id}`, {
      method: "GET",
      headers: {
        "User-Agent": env?.EMBED_USER_AGENT ?? "",
      },
    });
    if (!resp.ok) {
      throw { code: resp.status, message: resp.statusText };
    }
    const html = await resp.text();
    const $ = cheerio.load(html);
    let script: string;
    try {
      script = $("script#__UNIVERSAL_DATA_FOR_REHYDRATION__").text();
    } catch {
      throw {
        code: 500,
        message: "TikTok page structure changed: missing data script",
      };
    }

    let data: any;
    try {
      data = JSON.parse(script);
    } catch {
      throw { code: 500, message: "Failed to parse TikTok data" };
    }

    if (data?.__DEFAULT_SCOPE__?.["webapp.browserRedirect-context"]) {
      return this.fetch(
        data?.__DEFAULT_SCOPE__?.["webapp.browserRedirect-context"].browserRedirectUrl,
        env,
      );
    }

    let itemStruct = data?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct;
    if (!itemStruct) {
      throw {
        code: 500,
        message: "TikTok page structure changed: missing video data",
      };
    }
    return itemStruct;
  },
  async transform(raw) {
    console.log(raw);
    return {
      platform: this.type,
      author: {
        name: raw.author.nickname,
        avatar: raw.author.avatarMedium,
        handle: raw.author.uniqueId,
        url: `https://tiktok.com/@${raw.author.uniqueId}`,
      },
      timestamp: +raw.createTime,
      url: `https://tiktok.com/@${raw.author.uniqueId}/video/${raw.video.id}`,
      text: raw.desc,
      media: await parseMedia(raw),
      stats: {
        comments: raw.statsV2.commentCount,
        reposts: raw.statsV2.shareCount,
        likes: raw.statsV2.diggCount,
        views: raw.statsV2.playCount,
      },
    };
  },
} as const;
