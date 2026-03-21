import { Embed } from "@embedly/builder";
import he from "he";
import { CF_CACHE_OPTIONS } from "./constants.ts";
import {
  type BaseEmbedData,
  type CloudflareEnv,
  EmbedlyPlatform
} from "./Platform.ts";
import type { EmbedlyPlatformType } from "./types.ts";
import { signProxyUrl, validatePatternMatch } from "./utils.ts";

export abstract class EmbedlyMastodon extends EmbedlyPlatform {
  abstract readonly base_url: string;

  readonly pattern = new URLPattern({
    hostname: "{*.}?__PLACEHOLDER__"
  });

  constructor(
    name: EmbedlyPlatformType,
    cache_prefix: string,
    hostname: string
  ) {
    super(name, cache_prefix);
    this.pattern = new URLPattern({
      hostname: `{*.}?${hostname}`,
      pathname: "/@:username/posts/:status_id{/}?"
    });
  }

  async parsePostId(url: string): Promise<string> {
    const match = this.pattern.exec(url);
    validatePatternMatch(
      match,
      `Invalid ${this.name} URL: could not extract status ID`
    );
    return match.pathname.groups.status_id;
  }

  async fetchPost(
    status_id: string,
    env?: Partial<CloudflareEnv>
  ): Promise<any> {
    const resp = await fetch(
      `${this.base_url}/api/v1/statuses/${status_id}`,
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

    return await resp.json();
  }

  private stripHtml(html: string): string {
    return he.decode(
      html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>\s*<p>/gi, "\n\n")
        .replace(/<[^>]+>/g, "")
    );
  }

  transformRawData(raw_data: any): BaseEmbedData {
    return {
      platform: this.name,
      color: [...this.color],
      emoji: this.emoji,
      name: raw_data.account.display_name,
      username: raw_data.account.username,
      profile_url: raw_data.account.url,
      avatar_url: signProxyUrl(raw_data.account.avatar),
      timestamp: Math.floor(
        new Date(raw_data.created_at).getTime() / 1000
      ),
      url: raw_data.url,
      stats: {
        comments: raw_data.replies_count,
        reposts: raw_data.reblogs_count,
        likes: raw_data.favourites_count
      },
      description: raw_data.content
        ? this.stripHtml(raw_data.content)
        : undefined
    };
  }

  async createEmbed(post_data: any): Promise<Embed> {
    const embed = new Embed(this.transformRawData(post_data));

    if (post_data.media_attachments?.length > 0) {
      embed.setMedia(
        post_data.media_attachments.map((media: any) => ({
          media: { url: media.url },
          description: media.description
        }))
      );
    }

    if (post_data.quote) {
      const quote_embed = new Embed(
        this.transformRawData(post_data.quote)
      );
      if (post_data.quote.media_attachments?.length > 0) {
        quote_embed.setMedia(
          post_data.quote.media_attachments.map((media: any) => ({
            media: { url: media.url },
            description: media.description
          }))
        );
      }
      embed.setQuote(quote_embed);
    }

    if (post_data.in_reply_to_id && post_data.in_reply_to) {
      const reply_embed = new Embed(
        this.transformRawData(post_data.in_reply_to)
      );
      if (post_data.in_reply_to.media_attachments?.length > 0) {
        reply_embed.setMedia(
          post_data.in_reply_to.media_attachments.map((media: any) => ({
            media: { url: media.url },
            description: media.description
          }))
        );
      }
      embed.setReplyingTo(reply_embed);
    }

    return embed;
  }
}
