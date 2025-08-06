import { Embed } from "@embedly/builder";
import {
  EMBEDLY_FAILED_INSTAGRAM,
  EMBEDLY_FETCH_INSTAGRAM
} from "@embedly/logging";
import { IG_REGEX } from "@embedly/parser";
import {
  type BaseEmbedData,
  EmbedlyPlatformType
} from "@embedly/types";
import { EmbedlyPlatform } from "./Platform.ts";

export class Instagram extends EmbedlyPlatform {
  constructor() {
    super(EmbedlyPlatformType.Instagram, "insta", {
      fetching: EMBEDLY_FETCH_INSTAGRAM,
      failed: EMBEDLY_FAILED_INSTAGRAM
    });
  }

  parsePostId(url: string): string {
    const match = IG_REGEX.exec(url)!;
    const { ig_shortcode } = match.groups!;
    return ig_shortcode;
  }

  async fetchPost(
    ig_shortcode: string,
    env: { EMBED_USER_AGENT: string; IG_APP_ID: string }
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
        "User-Agent": env.EMBED_USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        "X-IG-App-ID": env.IG_APP_ID,
        "X-FB-LSD": "AVqbxe3J_YA",
        "X-ASBD-ID": "129477",
        "Sec-Fetch-Site": "same-origin"
      }
    });
    if (!resp.ok) {
      throw { code: resp.status, message: resp.statusText };
    }
    const { data } = JSON.parse(await resp.text());
    return data.xdt_shortcode_media;
  }

  parsePostMedia(post_data: Record<string, any>) {
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
    }
  }

  transformRawData(raw_data: any): BaseEmbedData {
    return {
      platform: this.name,
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
      description: raw_data.edge_media_to_caption.edges[0].node.text
    };
  }

  createEmbed(post_data: any): Embed {
    const embed = new Embed(this.transformRawData(post_data));
    const media = this.parsePostMedia(post_data);
    if (media.length > 10) {
      media.length = 10;
    }
    embed.setMedia(media);

    return embed;
  }
}
