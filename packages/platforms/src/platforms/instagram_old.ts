import { Platform } from "../types";
import type { IGMedia } from "./instagram.d";

const MATCH_RE =
  /^(?:https?:\/\/)?(?:[\w-]+\.)*instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|share|reels|reel)\/(?<ig_shortcode>[A-Za-z0-9-_]+)/;

export const Instagram: Platform<"Instagram", IGMedia, {}> = {
  type: "Instagram",
  async match(url) {
    if (url.includes("share")) {
      const req = await fetch(url.endsWith("/") ? url : `${url}/`, {
        redirect: "follow",
        headers: {
          "User-Agent": "curl/8.7.1",
        },
      });
      url = req.url;
    }

    const groups = url.match(MATCH_RE)?.groups;
    return groups?.ig_shortcode ?? null;
  },
  async fetch(id, env) {
    const graphql = new URL(`https://www.instagram.com/api/graphql`);
    graphql.searchParams.set("variables", JSON.stringify({ shortcode: id }));
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
        "Sec-Fetch-Site": "same-origin",
      },
    });

    if (!resp.ok) {
      throw { code: resp.status, message: resp.statusText };
    }

    const { data } = (await resp.json()) as { data?: { xdt_shortcode_media?: IGMedia } };
    const media = data?.xdt_shortcode_media;

    if (!media) {
      throw {
        code: 500,
        message: "Instagram API returned unexpected structure",
      };
    }

    return media;
  },
  async transform(raw) {
    const caption = raw.edge_media_to_caption.edges[0]?.node.text;
    const authorName = raw.owner.full_name || raw.owner.username;

    let media: Array<{ url: string; type: string }>;
    let views: number | undefined;

    if (raw.__typename === "XDTGraphVideo") {
      media = [{ url: raw.video_url, type: "video" }];
      views = raw.video_play_count;
    } else if (raw.__typename === "XDTGraphSidecar") {
      media = raw.edge_sidecar_to_children.edges.map(({ node }) =>
        node.__typename === "XDTGraphVideo"
          ? { url: node.video_url, type: "video" }
          : { url: node.display_url, type: "photo" },
      );
    } else {
      media = [{ url: raw.display_url, type: "photo" }];
    }

    return {
      platform: this.type,
      author: {
        name: authorName,
        handle: raw.owner.username,
        url: `https://www.instagram.com/${raw.owner.username}/`,
        avatar: raw.owner.profile_pic_url,
      },
      url: `https://www.instagram.com/p/${raw.shortcode}/`,
      text: caption,
      timestamp: raw.taken_at_timestamp,
      stats: {
        likes: raw.edge_media_preview_like.count,
        comments: raw.edge_media_to_comment.count,
        views,
      },
      media,
    };
  },
} as const;
