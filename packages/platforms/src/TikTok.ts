import { Embed } from "@embedly/builder";
import * as cheerio from "cheerio";
import { CF_CACHE_OPTIONS } from "./constants.ts";
import {
  type BaseEmbedData,
  type CloudflareEnv,
  EmbedlyPlatform
} from "./Platform.ts";
import { EmbedlyPlatformType } from "./types.ts";

const TIKTOK_REGEX_MAIN = /(https?:\/\/)?(?:[\w-]+\.)*tiktok\.com/;

const TIKTOK_REGEX_DETAIL =
  /https:\/\/(?:m|www|vm)?\.?tiktok\.com\/(?<tiktok_user>@[\w.-]+)\/video\/(?<tiktok_id>\d+)/;

export class TikTok extends EmbedlyPlatform {
  readonly color = [57, 118, 132] as const;
  readonly emoji = "<:tiktok:1386641825963708446>";
  readonly regex = TIKTOK_REGEX_MAIN;

  constructor() {
    super(EmbedlyPlatformType.TikTok, "tiktok");
  }

  async parsePostId(url: string): Promise<string> {
    const req = await fetch(url, { redirect: "follow" });
    const match = TIKTOK_REGEX_DETAIL.exec(req.url)!;
    const { tiktok_user, tiktok_id } = match.groups!;
    return `${tiktok_user}/${tiktok_id}`;
  }

  async fetchPost(
    post_id: string,
    env?: Partial<CloudflareEnv>
  ): Promise<any> {
    const [tiktok_user, tiktok_id] = post_id.split("/");
    const resp = await fetch(
      `https://www.tiktok.com/${tiktok_user}/video/${tiktok_id}`,
      {
        method: "GET",
        headers: {
          "User-Agent": env?.EMBED_USER_AGENT ?? ""
        },
        ...CF_CACHE_OPTIONS
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
      color: [...this.color],
      emoji: this.emoji,
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

  async createEmbed(post_data: any): Promise<Embed> {
    const embed = new Embed(this.transformRawData(post_data));
    const video = await fetch(
      post_data.video.bitrateInfo[0].PlayAddr.UrlList[2],
      { redirect: "follow" }
    );
    embed.setMedia([
      {
        media: {
          url: video.url
        }
      }
    ]);

    return embed;
  }
}
