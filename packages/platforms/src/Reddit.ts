import { Embed } from "@embedly/builder";
import { CF_CACHE_OPTIONS } from "./constants.ts";
import {
  type BaseEmbedData,
  type CloudflareEnv,
  EmbedlyPlatform
} from "./Platform.ts";
import { EmbedlyPlatformType } from "./types.ts";
import { validateRegexMatch } from "./utils.ts";

export class Reddit extends EmbedlyPlatform {
  readonly color = [255, 86, 0] as const;
  readonly emoji = "<:reddit:1461320093240655922>";
  readonly regex =
    /https?:\/\/(?:www\.|old\.|m\.)?reddit\.com\/r\/(?<subreddit>\w+)\/comments\/(?<post_id>[a-z0-9]+)/;

  constructor() {
    super(EmbedlyPlatformType.Reddit, "reddit");
  }

  async parsePostId(url: string): Promise<string> {
    const match = this.regex.exec(url);
    validateRegexMatch(
      match,
      "Invalid Reddit URL: could not extract post ID or subreddit"
    );
    const { post_id, subreddit } = match.groups;
    return `${subreddit}/${post_id}`;
  }

  async fetchPost(
    post_id: string,
    env?: Partial<CloudflareEnv>
  ): Promise<any> {
    const [subreddit, reddit_id] = post_id.split("/");
    const resp = await fetch(
      `https://www.reddit.com/r/${subreddit}/comments/${reddit_id}.json?raw_json=1`,
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

    const post_data = (await resp.json()) as Record<string, any>;

    const postDataItem = post_data?.[0]?.data?.children?.[0]?.data;

    if (!postDataItem) {
      throw {
        code: 500,
        message: "Reddit API returned unexpected structure"
      };
    }

    const authorName = postDataItem.author;

    if (!authorName) {
      throw {
        code: 500,
        message: "Reddit post missing author information"
      };
    }

    const profile_resp = await fetch(
      `https://www.reddit.com/user/${authorName}/about.json?raw_json=1`,
      {
        method: "GET",
        headers: {
          "User-Agent": env?.EMBED_USER_AGENT ?? ""
        },
        ...CF_CACHE_OPTIONS
      }
    );

    if (!profile_resp.ok) {
      throw {
        code: profile_resp.status,
        message: profile_resp.statusText
      };
    }

    const { data: profile_data } =
      (await profile_resp.json()) as Record<string, any>;

    if (!profile_data) {
      throw {
        code: 500,
        message: "Reddit profile API returned unexpected structure"
      };
    }

    return { post_data: postDataItem, profile_data };
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
      color: [...this.color],
      emoji: this.emoji,
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

    if (media.length > 0) {
      embed.setMedia(media);
    }

    return embed;
  }
}
