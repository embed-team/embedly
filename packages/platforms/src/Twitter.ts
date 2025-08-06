import { Embed } from "@embedly/builder";
import {
  EMBEDLY_FAILED_TWEET,
  EMBEDLY_FETCH_TWEET
} from "@embedly/logging";
import { TWITTER_REGEX } from "@embedly/parser";
import {
  type BaseEmbedData,
  EmbedlyPlatformType
} from "@embedly/types";
import he from "he";
import { EmbedlyPlatform } from "./Platform.ts";

export class Twitter extends EmbedlyPlatform {
  constructor() {
    super(EmbedlyPlatformType.Twitter, "tweet", {
      fetching: EMBEDLY_FETCH_TWEET,
      failed: EMBEDLY_FAILED_TWEET
    });
  }

  parsePostId(url: string): string {
    const match = TWITTER_REGEX.exec(url)!;
    const { tweet_id } = match.groups!;
    return tweet_id;
  }

  async fetchPost(tweet_id: string): Promise<any> {
    const { tweet, code, message } = await fetch(
      `https://api.fxtwitter.com/embedly/status/${tweet_id}`,
      {
        method: "GET",
        headers: {
          "User-Agent": "Embedly/0.0.1"
        },
        cf: {
          cacheTtl: 60 * 60 * 24,
          cacheEverything: true
        }
      }
    ).then((r) => r.json() as Record<string, any>);
    if (code !== 200) {
      throw { code, message };
    }

    let tweet_data = tweet;
    if (tweet.replying_to_status) {
      tweet_data = await this.fetchPost(tweet.replying_to_status);
      tweet_data.reply = tweet;
    }
    return tweet_data;
  }

  enrichTweetText(text_data: Record<string, any>) {
    let text = text_data.text as string;
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

  createEmbed(tweet_data: any): Embed {
    const embed = new Embed(this.transformRawData(tweet_data));
    if (tweet_data.text !== "") {
      embed.setDescription(this.enrichTweetText(tweet_data.raw_text));
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
    if (tweet_data.reply) {
      const reply_tweet = tweet_data.reply;
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
      embed.setReplyTweet(reply_embed);
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
      embed.setQuoteTweet(quote_embed);
    }
    return embed;
  }
}
