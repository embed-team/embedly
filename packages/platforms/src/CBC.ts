import { createHmac } from "node:crypto";
import { Embed } from "@embedly/builder";
import {
  EMBEDLY_FAILED_PLATFORM,
  EMBEDLY_FETCH_PLATFORM
} from "@embedly/logging";
import { CBC_REGEX } from "@embedly/parser";
import {
  type BaseEmbedData,
  EmbedlyPlatformType
} from "@embedly/types";
import * as cheerio from "cheerio";
import he from "he";
import { EmbedlyPlatform } from "./Platform.ts";

export class CBC extends EmbedlyPlatform {
  constructor() {
    super(EmbedlyPlatformType.CBC, "cbc.ca", {
      fetching: EMBEDLY_FETCH_PLATFORM(EmbedlyPlatformType.CBC),
      failed: EMBEDLY_FAILED_PLATFORM(EmbedlyPlatformType.CBC)
    });
  }

  async parsePostId(url: string): Promise<string> {
    const match = CBC_REGEX.exec(url)!;
    const { cbc_id } = match.groups!;
    return cbc_id;
  }

  async fetchPost(post_id: string): Promise<any> {
    const resp = await fetch(`https://cbc.ca/${post_id}`, {
      method: "GET",
      redirect: "follow",
      cf: {
        cacheTtl: 60 * 60 * 24,
        cacheEverything: true
      }
    });
    if (!resp.ok) {
      throw { code: resp.status, message: resp.statusText };
    }
    const html = await resp.text();
    const $ = cheerio.load(html);
    const script = $("script#initialStateDom");
    const data = JSON.parse(
      script
        .text()
        .replace("window.__INITIAL_STATE__ = ", "")
        .slice(0, -1)
    );
    return data.app.meta.jsonld;
  }

  transformRawData(raw_data: any): BaseEmbedData {
    return {
      platform: this.name,
      name: he.decode(raw_data.name),
      avatar_url: this.signProxyURL(raw_data.publisher.logo),
      timestamp: Math.floor(
        new Date(raw_data.datePublished).getTime() / 1000
      ),
      url: raw_data["@id"],
      description: he.decode(raw_data.description)
    };
  }

  signProxyURL(url: string) {
    const signature = createHmac(
      "sha256",
      process.env.DISCORD_BOT_TOKEN!
    )
      .update(url)
      .digest("hex");
    return `https://${process.env.EMBEDLY_API_DOMAIN!}/api/_image?url=${url}&sig=${signature}`;
  }

  createEmbed(post_data: any): Embed {
    const embed = new Embed(this.transformRawData(post_data));
    embed.setMedia([
      {
        media: {
          url: this.signProxyURL(post_data.thumbnailUrl)
        }
      }
    ]);

    return embed;
  }
}
