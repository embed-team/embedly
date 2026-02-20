import { Embed } from "@embedly/builder";
import * as cheerio from "cheerio";
import he from "he";
import { CF_CACHE_OPTIONS } from "./constants.ts";
import { type BaseEmbedData, EmbedlyPlatform } from "./Platform.ts";
import { EmbedlyPlatformType } from "./types.ts";
import { validateRegexMatch } from "./utils.ts";

export class NYTimes extends EmbedlyPlatform {
  readonly color = [0, 0, 0] as const;
  readonly emoji = "";
  readonly regex =
    /nytimes\.com\/(?<path>\d{4}\/\d{2}\/\d{2}\/[^?#]+\.html)/;

  constructor() {
    super(EmbedlyPlatformType.NYTimes, "nyt");
  }

  async parsePostId(url: string): Promise<string> {
    const match = this.regex.exec(url);
    validateRegexMatch(
      match,
      "Invalid NYTimes URL: could not extract path"
    );
    const { path } = match.groups;
    return path;
  }

  async fetchPost(post_id: string): Promise<any> {
    const resp = await fetch(`https://www.nytimes.com/${post_id}`, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Twitterbot/1.0"
      },
      ...CF_CACHE_OPTIONS
    });

    if (!resp.ok) {
      throw { code: resp.status, message: resp.statusText };
    }

    const html = await resp.text();
    const $ = cheerio.load(html);
    const script = $('script[type="application/ld+json"]').first();
    const scriptText = script.text();

    if (!scriptText) {
      throw {
        code: 500,
        message: "NYTimes page structure changed: missing JSON-LD data"
      };
    }

    let data: any;
    try {
      data = JSON.parse(scriptText);
    } catch {
      throw {
        code: 500,
        message: "Failed to parse NYTimes JSON-LD data"
      };
    }

    if (
      data["@type"] !== "NewsArticle" ||
      !data.headline ||
      !data.description
    ) {
      throw {
        code: 500,
        message:
          "NYTimes page structure changed: missing required fields"
      };
    }

    return data;
  }

  transformRawData(raw_data: any): BaseEmbedData {
    let description = he.decode(raw_data.description);

    if (
      raw_data.author &&
      Array.isArray(raw_data.author) &&
      raw_data.author.length > 0
    ) {
      const byline = raw_data.author
        .map((a: any) => a.name)
        .join(" and ");
      description = `By ${byline}\n\n${description}`;
    }

    return {
      platform: this.name,
      color: [...this.color],
      emoji: this.emoji,
      name: he.decode(raw_data.headline),
      avatar_url:
        "https://static01.nyt.com/images/icons/t_logo_291_black.png",
      timestamp: Math.floor(
        new Date(raw_data.datePublished).getTime() / 1000
      ),
      url: raw_data["@id"],
      description
    };
  }

  createEmbed(post_data: any): Embed {
    const embed = new Embed(this.transformRawData(post_data));

    if (
      post_data.image &&
      Array.isArray(post_data.image) &&
      post_data.image.length > 0
    ) {
      const image = post_data.image[0];
      embed.setMedia([
        {
          media: {
            url: image.url
          },
          description: image.caption
        }
      ]);
    }

    return embed;
  }
}
