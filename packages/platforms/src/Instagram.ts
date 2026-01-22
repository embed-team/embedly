import { Embed } from "@embedly/builder";
import { CF_CACHE_OPTIONS } from "./constants.ts";
import {
  type BaseEmbedData,
  type CloudflareEnv,
  EmbedlyPlatform
} from "./Platform.ts";
import { EmbedlyPlatformType } from "./types.ts";

export class Instagram extends EmbedlyPlatform {
  readonly color = [225, 48, 108] as const;
  readonly emoji = "<:instagram:1386639712013254748>";
  readonly regex =
    /instagram.com\/(?:[A-Za-z0-9_.]+\/)?(p|share|reels|reel|stories)\/(?<ig_shortcode>[A-Za-z0-9-_]+)/;

  constructor() {
    super(EmbedlyPlatformType.Instagram, "insta");
  }

  async parsePostId(url: string): Promise<string> {
    if (url.includes("share")) {
      const req = await fetch(url.endsWith("/") ? url : `${url}/`, {
        redirect: "follow",
        headers: {
          "User-Agent": "curl/8.7.1"
        }
      });
      url = req.url;
    }
    const match = this.regex.exec(url)!;
    const { ig_shortcode } = match.groups!;
    return ig_shortcode;
  }

  async fetchPost(
    ig_shortcode: string,
    env?: Partial<CloudflareEnv>
  ): Promise<any> {
    const graphql = new URL(`https://www.instagram.com/api/graphql`);
    graphql.searchParams.set(
      "variables",
      JSON.stringify({ shortcode: ig_shortcode })
    );
    graphql.searchParams.set("doc_id", "10015901848480474");
    graphql.searchParams.set("lsd", "AVqbxe3J_YA");

    const resp = await fetch(graphql.toString(), {
      method: "POST",
      headers: {
        "User-Agent": env?.EMBED_USER_AGENT ?? "",
        "Content-Type": "application/x-www-form-urlencoded",
        "X-IG-App-ID": "936619743392459",
        "X-FB-LSD": "AVqbxe3J_YA",
        "X-ASBD-ID": "129477",
        "Sec-Fetch-Site": "same-origin"
      },
      ...CF_CACHE_OPTIONS
    });
    if (!resp.ok) {
      throw { code: resp.status, message: resp.statusText };
    }
    const { data } = (await resp.json()) as Record<string, any>;
    return data.xdt_shortcode_media;
  }

  parsePostMedia(
    post_data: Record<string, any>
  ): Parameters<Embed["setMedia"]>[0] {
    switch (post_data.__typename) {
      case "XDTGraphSidecar": {
        return post_data.edge_sidecar_to_children.edges.map(
          (edge: any) => ({
            media: {
              url: edge.node.is_video
                ? edge.node.video_url
                : edge.node.display_url
            },
            description: edge.node.accessibility_caption
          })
        );
      }

      case "XDTGraphVideo": {
        return [
          {
            media: {
              url: post_data.video_url
            }
          }
        ];
      }
      case "XDTGraphImage": {
        return [
          {
            media: {
              url: post_data.display_url
            },
            description: post_data.accessibility_caption
          }
        ];
      }
      default: {
        return [];
      }
    }
  }

  transformRawData(raw_data: any): BaseEmbedData {
    return {
      platform: this.name,
      color: [...this.color],
      emoji: this.emoji,
      name: raw_data.owner.full_name,
      username: raw_data.owner.username,
      profile_url: `https://instagram.com/${raw_data.owner.username}`,
      avatar_url: raw_data.owner.profile_pic_url,
      timestamp: raw_data.taken_at_timestamp,
      url: raw_data.url,
      stats: {
        comments: raw_data.edge_media_to_comment.count,
        likes: raw_data.edge_media_preview_like.count
      },
      description:
        raw_data.edge_media_to_caption.edges[0]?.node?.text ?? ""
    };
  }

  createEmbed(post_data: any): Embed {
    const embed = new Embed(this.transformRawData(post_data));
    const media = this.parsePostMedia(post_data);
    // Media truncation will be handled by Embed.setMedia
    embed.setMedia(media);

    return embed;
  }
}
