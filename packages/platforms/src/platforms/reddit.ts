import { NormalizedPost, Platform } from "../types";
import type {
  RedditListing,
  RedditMediaMetadata,
  RedditPost,
  RedditPostData,
  RedditProfileResponse,
} from "./reddit.d";

const DIRECT_RE =
  /^(?:https?:\/\/)?(?:(?:www|old|m)\.)?reddit\.com\/(?:(?:(?:r|u|user)\/[^/\s]+)\/)?comments\/(?<post_id>[a-z0-9]+)(?:\/[^\s]*)?$/i;
const SHORT_RE = /^(?:https?:\/\/)?(?:www\.)?redd\.it\/(?<post_id>[a-z0-9]+)\/?(?:[?#][^\s]*)?$/i;
const SHARE_RE =
  /^(?:https?:\/\/)?(?:(?:www|old|m)\.)?reddit\.com\/(?:r|u|user)\/[^/\s]+\/s\/[A-Za-z0-9]{10}\/?(?:[?#][^\s]*)?$/i;
const REDDIT_AVATAR = "https://www.redditstatic.com/desktop2x/img/favicon/android-icon-192x192.png";

function postId(url: string) {
  return url.match(DIRECT_RE)?.groups?.post_id ?? url.match(SHORT_RE)?.groups?.post_id ?? null;
}

function mediaURL(media: RedditMediaMetadata) {
  if (media.status && media.status !== "valid") return null;

  const url = media.e === "AnimatedImage" ? media.s.gif : media.s.u;
  if (!url) return null;

  return url.replace("https://preview.redd.it/", "https://i.redd.it/").split("?")[0];
}

function parseMedia(raw: RedditPostData): NormalizedPost["media"] {
  if (raw.gallery_data && raw.media_metadata) {
    return raw.gallery_data.items.flatMap(({ media_id }) => {
      const media = raw.media_metadata?.[media_id];
      if (!media) return [];

      const url = mediaURL(media);
      return url ? [{ url, type: "photo" }] : [];
    });
  }

  if (raw.media?.reddit_video) {
    return [{ url: raw.media.reddit_video.fallback_url, type: "video" }];
  }

  if (raw.post_hint === "image" && raw.url) {
    return [{ url: raw.url, type: "photo" }];
  }

  if (raw.domain === "i.redd.it" && raw.url_overridden_by_dest) {
    return [{ url: raw.url_overridden_by_dest, type: "photo" }];
  }

  const preview = raw.preview?.images[0]?.source.url;
  return preview ? [{ url: preview, type: "photo" }] : [];
}

function parseText(raw: RedditPostData) {
  const title = `### ${raw.title.trim()}`;
  const body = raw.selftext.trim();
  const isExternalLink =
    raw.url &&
    (raw.post_hint === "link" ||
      raw.post_hint === "rich:video" ||
      (!raw.post_hint &&
        !raw.gallery_data &&
        !raw.media?.reddit_video &&
        !raw.url.startsWith("/") &&
        !raw.url.startsWith("https://www.reddit.com/")));

  return [title, isExternalLink ? raw.url : null, body].filter(Boolean).join("\n\n");
}

async function fetchReddit(
  path: string,
  env: { EMBED_USER_AGENT: string; REDDIT_COOKIE?: string },
) {
  if (!env.REDDIT_COOKIE) {
    throw { code: 500, message: "Reddit cookie is not configured" };
  }

  return fetch(`https://www.reddit.com${path}`, {
    headers: {
      Cookie: env.REDDIT_COOKIE,
      "User-Agent": env.EMBED_USER_AGENT,
    },
  });
}

export const Reddit: Platform<"Reddit", RedditPost, {}> = {
  type: "Reddit",
  async match(url, env) {
    const id = postId(url);
    if (id) return id;
    if (!SHARE_RE.test(url)) return null;

    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: env ? { "User-Agent": env.EMBED_USER_AGENT } : undefined,
    });
    return postId(response.url);
  },
  async fetch(id, env) {
    if (!env) {
      throw { code: 500, message: "Reddit environment is not configured" };
    }

    const postResponse = await fetchReddit(`/comments/${id}.json?raw_json=1`, env);
    if (!postResponse.ok) {
      throw { code: postResponse.status, message: postResponse.statusText };
    }
    if (!postResponse.headers.get("Content-Type")?.includes("application/json")) {
      throw { code: 502, message: "Reddit returned a non-JSON response" };
    }

    // SAFETY: response content type and Reddit listing shape are checked before field access.
    const listings = (await postResponse.json()) as RedditListing[];
    const post = listings[0]?.data?.children?.[0]?.data;
    if (!post) {
      throw { code: 502, message: "Reddit API returned unexpected structure" };
    }

    const author = post.author || "[deleted]";
    let avatar = REDDIT_AVATAR;
    if (author !== "[deleted]") {
      const profileResponse = await fetchReddit(`/user/${author}/about.json?raw_json=1`, env);
      if (profileResponse.ok) {
        // SAFETY: optional profile fields are checked before use.
        const profile = (await profileResponse.json()) as RedditProfileResponse;
        avatar = profile.data?.icon_img || avatar;
      }
    }

    return { ...post, author, profile: { icon_img: avatar } };
  },
  async transform(raw) {
    return {
      platform: this.type,
      author: {
        name: raw.subreddit_name_prefixed,
        avatar: raw.profile.icon_img,
        handle: raw.author,
        url: raw.author === "[deleted]" ? undefined : `https://reddit.com/user/${raw.author}`,
      },
      timestamp: raw.created_utc,
      url: `https://www.reddit.com${raw.permalink}`,
      text: parseText(raw),
      media: parseMedia(raw),
      stats: {
        comments: raw.num_comments,
        likes: raw.ups,
      },
    };
  },
} as const;
