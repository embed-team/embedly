import { NormalizedPost, Platform } from "../types";
import type { InstagramMedia } from "./instagram.d";

interface InstagramHTMLRewriter {
  on(
    selector: string,
    handlers: {
      element?(element: {
        getAttribute(name: string): string | null;
        hasAttribute(name: string): boolean;
        onEndTag(handler: () => void): void;
      }): void;
      text?(chunk: { text: string }): void;
    },
  ): InstagramHTMLRewriter;
  transform(response: Response): Response;
}

declare const HTMLRewriter: { new (): InstagramHTMLRewriter };

const MATCH_RE =
  /^(?:https?:\/\/)?(?:[\w-]+\.)*instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(?<ig_type>p|share|reels|reel)\/(?<ig_shortcode>[A-Za-z0-9-_]+)/;

const PRELOADER_PREFIX = "adp_PolarisLoggedOutDesktopWWWPostRootContentQueryRelayPreloader_";

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

  // SAFETY: Instagram relay media is checked against live image, reel, and carousel samples.
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
    const resp = await (env?.INSTAGRAM_FETCH ?? fetch)(
      `https://www.instagram.com/${normalizeType(type)}/${shortcode}/`,
      {
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
      },
    );

    if (!resp.ok) {
      throw { code: resp.status, message: resp.statusText };
    }

    let script: string | undefined;
    let scriptChunks: string[] = [];
    let captureScript = false;
    let textTail = "";
    let ageRestricted = false;
    let postUnavailable = false;
    let insideScriptOrStyle = false;
    const rewritten = new HTMLRewriter()
      .on("script", {
        element(element) {
          insideScriptOrStyle = true;
          captureScript =
            element.getAttribute("type") === "application/json" && element.hasAttribute("data-sjs");
          scriptChunks = [];
          element.onEndTag(() => {
            insideScriptOrStyle = false;
            if (!captureScript) return;
            const candidate = scriptChunks.join("");
            if (
              candidate.includes("RelayPrefetchedStreamCache") &&
              candidate.includes(PRELOADER_PREFIX)
            ) {
              script = candidate;
            }
          });
        },
        text(chunk) {
          if (captureScript) scriptChunks.push(chunk.text);
        },
      })
      .on("style", {
        element(element) {
          insideScriptOrStyle = true;
          element.onEndTag(() => {
            insideScriptOrStyle = false;
          });
        },
      })
      .on("body", {
        text(chunk) {
          if (insideScriptOrStyle) return;
          const text = (textTail + chunk.text).replace(/\s+/g, " ").replace(/\u2019/g, "'");
          ageRestricted ||= text.includes("Age-restricted content");
          postUnavailable ||= text.includes("Post isn't available");
          textTail = text.slice(-32);
        },
      })
      .transform(resp);
    await rewritten.body?.pipeTo(new WritableStream());

    let media: InstagramMedia | undefined | null;
    if (script) {
      try {
        media = parseRelayMedia(script);
      } catch {
        throw { code: 500, message: "Failed to parse Instagram data" };
      }
    }

    if (!media) {
      let reason = "instagram.media_unavailable";
      let code = 500;
      if (ageRestricted) {
        reason = "instagram.age_restricted";
        code = 403;
      } else if (postUnavailable) {
        reason = "instagram.post_unavailable";
        code = 404;
      }
      throw {
        code,
        reason,
        message: script
          ? "Instagram page structure changed: missing media data"
          : "Instagram page structure changed: missing data script",
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
