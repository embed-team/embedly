import * as cheerio from "cheerio";

import { NormalizedPost, Platform } from "../types";

const MATCH_RE =
  /^(?:https?:\/\/)?(?:[\w-]+\.)*instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(?<ig_type>p|share|reels|reel)\/(?<ig_shortcode>[A-Za-z0-9-_]+)/;

const PRELOADER_PREFIX = "adp_PolarisLoggedOutDesktopWWWPostRootContentQueryRelayPreloader_";

interface InstagramImageCandidate {
  url: string;
}

interface InstagramMedia {
  __typename?: string;
  code: string;
  taken_at: number;
  caption?: { text?: string } | null;
  user: {
    username: string;
    full_name?: string;
    profile_pic_url: string;
  };
  like_count?: number;
  comment_count?: number;
  product_type?: string;
  play_count?: number;
  video_play_count?: number;
  view_count?: number;
  accessibility_caption?: string;
  image_versions2?: {
    candidates?: InstagramImageCandidate[];
  };
  video_versions?: Array<{ url: string }>;
  carousel_media?: InstagramMedia[];
}

function normalizeType(type: string) {
  if (type === "reels") return "reel";
  return type;
}

function firstImage(raw: InstagramMedia) {
  return raw.image_versions2?.candidates?.[0]?.url;
}

function mediaURL(raw: InstagramMedia) {
  const video = raw.video_versions?.[0]?.url;
  if (video) return { url: video, type: "video", description: raw.accessibility_caption };

  const image = firstImage(raw);
  if (image) return { url: image, type: "photo", description: raw.accessibility_caption };

  return null;
}

function parseMedia(raw: InstagramMedia): NormalizedPost["media"] {
  if (raw.carousel_media) {
    return raw.carousel_media.map(mediaURL).filter((media) => media !== null);
  }

  const media = mediaURL(raw);
  if (!media) return [];

  return [media];
}

function parseRelayMedia(script: string) {
  const data = JSON.parse(script);
  const requireItems = data?.require?.[0]?.[3]?.[0]?.__bbox?.require;
  if (!Array.isArray(requireItems)) return null;

  const relayRequire = requireItems.find(
    (item) =>
      item[0] === "RelayPrefetchedStreamCache" && item[3]?.[0]?.startsWith(PRELOADER_PREFIX),
  );

  return relayRequire?.[3]?.[1]?.__bbox?.result?.data?.xig_polaris_media
    ?.if_not_gated_logged_out as InstagramMedia | undefined;
}

export const Instagram: Platform<"Instagram", InstagramMedia, {}> = {
  type: "Instagram",
  async match(url, env) {
    if (url.includes("share")) {
      const req = await fetch(url.endsWith("/") ? url : `${url}/`, {
        redirect: "follow",
        headers: {
          "User-Agent": env?.EMBED_USER_AGENT ?? "curl/8.7.1",
        },
      });
      url = req.url;
    }

    const groups = url.match(MATCH_RE)?.groups;
    if (!groups) return null;

    const type = normalizeType(groups.ig_type);
    return `${type}/${groups.ig_shortcode}`;
  },
  async fetch(id, env) {
    const [type, shortcode] = id.includes("/") ? id.split("/") : ["p", id];
    const resp = await fetch(`https://www.instagram.com/${normalizeType(type)}/${shortcode}/`, {
      method: "GET",
      headers: {
        "User-Agent": env?.EMBED_USER_AGENT ?? "",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
      },
    });

    if (!resp.ok) {
      throw { code: resp.status, message: resp.statusText };
    }

    const html = await resp.text();
    const $ = cheerio.load(html);
    const script = $('script[type="application/json"][data-sjs]')
      .toArray()
      .map((el) => $(el).text())
      .find(
        (text) => text.includes("RelayPrefetchedStreamCache") && text.includes(PRELOADER_PREFIX),
      );

    if (!script) {
      throw {
        code: 500,
        message: "Instagram page structure changed: missing data script",
      };
    }

    let media: InstagramMedia | undefined | null;
    try {
      media = parseRelayMedia(script);
    } catch {
      throw { code: 500, message: "Failed to parse Instagram data" };
    }

    if (!media) {
      throw {
        code: 500,
        message: "Instagram page structure changed: missing media data",
      };
    }

    return media;
  },
  async transform(raw) {
    const authorName = raw.user.full_name || raw.user.username;
    const path = raw.product_type === "clips" ? "reel" : "p";

    return {
      platform: this.type,
      author: {
        name: authorName,
        handle: raw.user.username,
        url: `https://www.instagram.com/${raw.user.username}/`,
        avatar: raw.user.profile_pic_url,
      },
      url: `https://www.instagram.com/${path}/${raw.code}/`,
      text: raw.caption?.text,
      timestamp: raw.taken_at,
      stats: {
        likes: raw.like_count,
        comments: raw.comment_count,
        views: raw.play_count ?? raw.video_play_count ?? raw.view_count,
      },
      media: parseMedia(raw),
    };
  },
} as const;
