import { Embed } from "@embedly/builder";
import {
  EMBEDLY_FAILED_PLATFORM,
  EMBEDLY_FETCH_PLATFORM
} from "@embedly/logging";
import { REDDIT_REGEX } from "@embedly/parser";
import {
  type BaseEmbedData,
  EmbedlyPlatformType
} from "@embedly/types";
import { EmbedlyPlatform } from "./Platform.ts";

export class Reddit extends EmbedlyPlatform {
  constructor() {
    super(EmbedlyPlatformType.Reddit, "reddit", {
      fetching: EMBEDLY_FETCH_PLATFORM(EmbedlyPlatformType.Reddit),
      failed: EMBEDLY_FAILED_PLATFORM(EmbedlyPlatformType.Reddit)
    });
  }

  async parsePostId(url: string): Promise<string> {
    const match = REDDIT_REGEX.exec(url)!;
    const { post_id, subreddit } = match.groups!;
    return `${subreddit}/${post_id}`;
  }

  async fetchPost(
    post_id: string,
    env: { EMBED_USER_AGENT: string }
  ): Promise<any> {
    const [subreddit, reddit_id] = post_id.split("/");
    const resp = await fetch(
      `https://www.reddit.com/r/${subreddit}/comments/${reddit_id}.json?raw_json=1`,
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

    const post_data = (await resp.json()) as Record<string, any>;

    const profile_resp = await fetch(
      `https://www.reddit.com/user/${post_data.author}/about.json?raw_json=1`,
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

    if (!profile_resp.ok) {
      throw { code: resp.status, message: resp.statusText };
    }

    const { data: profile_data } =
      (await profile_resp.json()) as Record<string, any>;

    return {
      post_data: post_data[0].data.children[0].data,
      profile_data
    };
  }

  parsePostMedia(
    post_data: Record<string, any>
  ): Parameters<Embed["setMedia"]>[0] {
    if (post_data.domain === "i.redd.it") {
      return [
        {
          media: {
            url: post_data.url_overridden_by_dest
          }
        }
      ];
    }
    if (post_data.media_metadata) {
      return Object.values(post_data.media_metadata).map(
        (media: any) => ({
          media: {
            url: media.s.u
          }
        })
      );
    }

    if (post_data.preview?.enabled) {
      return post_data.preview.images.map((media: any) => ({
        media: {
          url: media.source.url
        }
      }));
    }

    if (post_data.media?.reddit_video) {
      return [
        {
          media: {
            url: post_data.media.reddit_video.fallback_url
          }
        }
      ];
    }

    return [];
  }

  async transformRawData({
    post_data,
    profile_data
  }: any): Promise<BaseEmbedData> {
    return {
      platform: this.name,
      username: post_data.author,
      name: post_data.subreddit_name_prefixed,
      profile_url: `https://reddit.com/user/${post_data.author}`,
      avatar_url: profile_data.icon_img,
      timestamp: post_data.created_utc,
      url: `https://reddit.com/${post_data.permalink}`,
      description: `## ${post_data.title}\n${post_data.selftext}`
    };
  }

  async createEmbed(reddit_data: any): Promise<Embed> {
    const data = await this.transformRawData(reddit_data);
    const media = this.parsePostMedia(reddit_data.post_data);
    if (
      media.length === 0 &&
      reddit_data.post_data.url_overridden_by_dest
    ) {
      data.description += `\n${reddit_data.post_data.url_overridden_by_dest}`;
    }

    const embed = new Embed(data);

    if (media.length > 10) {
      media.length = 10;
    }
    if (media.length > 0) {
      embed.setMedia(media);
    }

    return embed;
  }
}
