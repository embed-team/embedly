import { Embed } from "@embedly/builder";
import he from "he";
import packageJSON from "../package.json" with { type: "json" };
import { CF_CACHE_OPTIONS } from "./constants.ts";
import { type BaseEmbedData, EmbedlyPlatform } from "./Platform.ts";
import { EmbedlyPlatformType } from "./types.ts";
import { validateRegexMatch } from "./utils.ts";

export class Twitter extends EmbedlyPlatform {
  readonly color = [29, 161, 242] as const;
  readonly emoji = "<:twitter:1386639732179599481>";
  readonly regex =
    /(?:twitter|x).com\/.*\/status(?:es)?\/(?<tweet_id>[^/?]+)/;

  constructor() {
    super(EmbedlyPlatformType.Twitter, "tweet");
  }

  async parsePostId(url: string): Promise<string> {
    const match = this.regex.exec(url);
    validateRegexMatch(
      match,
      "Invalid Twitter URL: could not extract tweet ID"
    );
    const { tweet_id } = match.groups;
    return tweet_id;
  }

  async fetchPost(tweet_id: string): Promise<any> {
    const resp = await fetch(
      `https://api.fxtwitter.com/embedly/status/${tweet_id}/en`,
      {
        method: "GET",
        headers: {
          "User-Agent": `Embedly/${packageJSON.version}`
        },
        ...CF_CACHE_OPTIONS
      }
    );

    if (!resp.ok) {
      throw { code: resp.status, message: resp.statusText };
    }

    const { tweet, code, message } = (await resp.json()) as Record<
      string,
      any
    >;

    if (code !== 200) {
      throw { code, message };
    }

    return tweet;
  }

  enrichTweetText(text_data: Record<string, any>) {
    let text = text_data.text as string;

    if (!text_data.facets || !Array.isArray(text_data.facets)) {
      return he.decode(text);
    }

    for (const facet of text_data.facets) {
      if (facet.type === "url") {
        text = text.replace(facet.original, facet.replacement);
      }
      if (facet.type === "hashtag") {
        text = text.replace(
          `#${facet.original}`,
          `[#${facet.original}](https://x.com/hashtag/${facet.original})`
        );
      }
      if (facet.type === "media") {
        text = text.replace(facet.original, "");
      }
    }

    return he.decode(text);
  }

  transformRawData(raw_data: any): BaseEmbedData {
    return {
      platform: this.name,
      color: [...this.color],
      emoji: this.emoji,
      name: raw_data.author.name,
      username: raw_data.author.screen_name,
      profile_url: `https://x.com/${raw_data.author.screen_name}`,
      avatar_url: raw_data.author.avatar_url,
      timestamp: raw_data.created_timestamp,
      url: raw_data.url,
      stats: {
        comments: raw_data.replies,
        reposts: raw_data.retweets,
        likes: raw_data.likes,
        bookmarks: raw_data.bookmarks
      }
    };
  }

  async createEmbed(tweet_data: any): Promise<Embed> {
    const embed = new Embed(this.transformRawData(tweet_data));
    if (tweet_data.text !== "") {
      embed.setDescription(this.enrichTweetText(tweet_data.raw_text));
    }
    if (tweet_data.translation?.text) {
      embed.setDescription(tweet_data.translation.text);
    }
    if (tweet_data.media) {
      embed.setMedia(
        tweet_data.media.all.map((media: any) => ({
          media: {
            url: media.url
          },
          description: media.altText
        }))
      );
    }
    if (tweet_data.replying_to_status) {
      const reply_tweet = await this.fetchPost(
        tweet_data.replying_to_status
      );
      const reply_embed = new Embed(this.transformRawData(reply_tweet));
      if (reply_tweet.text !== "") {
        reply_embed.setDescription(
          this.enrichTweetText(reply_tweet.raw_text)
        );
      }
      if (reply_tweet.media) {
        reply_embed.setMedia(
          reply_tweet.media.all.map((media: any) => ({
            media: {
              url: media.url
            },
            description: media.altText
          }))
        );
      }
      embed.setReplyingTo(reply_embed);
    } else if (tweet_data.quote) {
      const quote_tweet = tweet_data.quote;
      const quote_embed = new Embed(this.transformRawData(quote_tweet));
      if (quote_tweet.text !== "") {
        quote_embed.setDescription(
          this.enrichTweetText(quote_tweet.raw_text)
        );
      }
      if (quote_tweet.media) {
        quote_embed.setMedia(
          quote_tweet.media.all.map((media: any) => ({
            media: {
              url: media.url
            },
            description: media.altText
          }))
        );
      }
      embed.setQuote(quote_embed);
    }
    return embed;
  }
}
