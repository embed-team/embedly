import { Embed } from "@embedly/builder";
import {
  EMBEDLY_FAILED_PLATFORM,
  EMBEDLY_FETCH_PLATFORM
} from "@embedly/logging";
import { TIKTOK_REGEX } from "@embedly/parser";
import {
  type BaseEmbedData,
  EmbedlyPlatformType
} from "@embedly/types";
import * as cheerio from "cheerio";
import { EmbedlyPlatform } from "./Platform.ts";

export class TikTok extends EmbedlyPlatform {
  constructor() {
    super(EmbedlyPlatformType.TikTok, "tiktok", {
      fetching: EMBEDLY_FETCH_PLATFORM(EmbedlyPlatformType.TikTok),
      failed: EMBEDLY_FAILED_PLATFORM(EmbedlyPlatformType.TikTok)
    });
  }

  async parsePostId(url: string): Promise<string> {
    const req = await fetch(url, { redirect: "follow" });
    const match = TIKTOK_REGEX.exec(req.url)!;
    const { tiktok_user, tiktok_id } = match.groups!;
    return `${tiktok_user}/${tiktok_id}`;
  }

  async fetchPost(
    post_id: string,
    env: { EMBED_USER_AGENT: string }
  ): Promise<any> {
    const [tiktok_user, tiktok_id] = post_id.split("/");
    const resp = await fetch(
      `https://www.tiktok.com/${tiktok_user}/video/${tiktok_id}`,
      {
        method: "GET",
        headers: {
          "User-Agent": env.EMBED_USER_AGENT
        },
        cf: {
          cacheTtl: 60 * 60 * 24,
          cacheEverything: true
        }
      }
    );
    if (!resp.ok) {
      throw { code: resp.status, message: resp.statusText };
    }
    const html = await resp.text();
    const $ = cheerio.load(html);
    const script = $("script#__UNIVERSAL_DATA_FOR_REHYDRATION__");
    const data = JSON.parse(script.text());
    return data.__DEFAULT_SCOPE__["webapp.video-detail"].itemInfo
      .itemStruct;
  }

  transformRawData(raw_data: any): BaseEmbedData {
    return {
      platform: this.name,
      name: raw_data.author.nickname,
      username: raw_data.author.uniqueId,
      profile_url: `https://tiktok.com/@${raw_data.author.uniqueId}`,
      avatar_url: raw_data.author.avatarMedium,
      timestamp: +raw_data.createTime,
      url: `https://tiktok.com/@${raw_data.author.uniqueId}/video/${raw_data.video.id}`,
      stats: {
        comments: raw_data.statsV2.commentCount,
        reposts: raw_data.statsV2.shareCount,
        likes: raw_data.statsV2.diggCount,
        views: raw_data.statsV2.playCount
      },
      description: raw_data.desc
    };
  }

  createEmbed(post_data: any): Embed {
    const embed = new Embed(this.transformRawData(post_data));
    embed.setMedia([
      {
        media: {
          url: post_data.video.bitrateInfo[0].PlayAddr.UrlList[2]
        }
      }
    ]);

    return embed;
  }
}
