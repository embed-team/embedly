import { NormalizedPost, Platform } from "../types";

const MATCH_RE =
  /^(?:https?:\/\/)?(?:www\.|old\.)?(?:reddit\.com\/r\/[A-Za-z0-9_]+\/(?:comments\/[A-Za-z0-9]+(?:\/[^/\s]+)?|s\/[A-Za-z0-9]+)|redd\.it\/[A-Za-z0-9]+)\/?/;
const FOLLOWUP_RE =
  /^(?:https?:\/\/)?(?:www\.|old\.|m\.)?reddit\.com\/r\/(?<subreddit>\w+)\/comments\/(?<post_id>[a-z0-9]+)/;

interface RedditAccessTokenResponse {
  access_token?: string;
}

interface RedditMediaMetadata {
  s: { u: string };
}

interface RedditPostData {
  author: string;
  subreddit_name_prefixed: string;
  created_utc: number;
  permalink: string;
  title: string;
  selftext: string;
  num_comments: number;
  ups: number;
  domain?: string;
  url_overridden_by_dest?: string;
  media_metadata?: Record<string, RedditMediaMetadata>;
  preview?: {
    enabled: boolean;
    images: Array<{ source: { url: string } }>;
  };
  media?: {
    reddit_video?: { fallback_url: string };
  };
}

interface RedditProfile {
  icon_img: string;
}

interface RedditPost extends RedditPostData {
  profile: RedditProfile;
}

interface RedditListing {
  data?: {
    children?: Array<{ data?: RedditPostData }>;
  };
}

interface RedditProfileResponse {
  data?: RedditProfile;
}

async function fetchAccessToken(env: {
  EMBED_USER_AGENT: string;
  REDDIT_CLIENT_ID?: string;
  REDDIT_CLIENT_SECRET?: string;
}) {
  if (!env.REDDIT_CLIENT_ID || !env.REDDIT_CLIENT_SECRET) {
    throw {
      code: 500,
      message: "Reddit credentials are not configured",
    };
  }

  const resp = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": env.EMBED_USER_AGENT,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  if (!resp.ok) {
    throw { code: resp.status, message: resp.statusText };
  }

  // SAFETY: response uses Reddit's OAuth token contract.
  const data = (await resp.json()) as RedditAccessTokenResponse;
  if (!data.access_token) {
    throw { code: 500, message: "Reddit OAuth response missing access token" };
  }
  return data.access_token;
}

async function fetchReddit(
  path: string,
  env: { EMBED_USER_AGENT: string; REDDIT_CLIENT_ID?: string; REDDIT_CLIENT_SECRET?: string },
) {
  const token = await fetchAccessToken(env);
  return fetch(`https://oauth.reddit.com${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": env.EMBED_USER_AGENT,
    },
  });
}

function parseMedia(raw: RedditPostData): NormalizedPost["media"] {
  if (raw.domain === "i.redd.it" && raw.url_overridden_by_dest) {
    return [
      {
        url: raw.url_overridden_by_dest,
        type: "photo",
      },
    ];
  }

  if (raw.media_metadata) {
    return Object.values(raw.media_metadata).map((media) => ({
      url: media.s.u,
      type: "unknown",
    }));
  }

  if (raw.preview?.enabled) {
    return raw.preview.images.map((media) => ({
      url: media.source.url,
      type: "unknown",
    }));
  }

  if (raw.media?.reddit_video) {
    return [
      {
        url: raw.media.reddit_video.fallback_url,
        type: "video",
      },
    ];
  }

  return [];
}

export const Reddit: Platform<"Reddit", RedditPost, {}> = {
  type: "Reddit",
  async match(url, env) {
    const match = url.match(MATCH_RE);
    if (!match) return null;

    const directGroups = url.match(FOLLOWUP_RE)?.groups;
    if (directGroups) {
      const { subreddit, post_id } = directGroups;
      return `${subreddit}/${post_id}`;
    }

    const req = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: env ? { "User-Agent": env.EMBED_USER_AGENT } : undefined,
    });

    const groups = req.url.match(FOLLOWUP_RE)?.groups;
    if (!groups) return null;
    const { subreddit, post_id } = groups;
    return `${subreddit}/${post_id}`;
  },
  async fetch(id, env) {
    if (!env) {
      throw {
        code: 500,
        message: "Reddit environment is not configured",
      };
    }

    const [subreddit, reddit_id] = id.split("/");
    const postResp = await fetchReddit(
      `/r/${subreddit}/comments/${reddit_id}.json?raw_json=1`,
      env,
    );

    if (!postResp.ok) {
      throw { code: postResp.status, message: postResp.statusText };
    }

    // SAFETY: response uses Reddit's listing contract.
    const postData = (await postResp.json()) as RedditListing[];
    const postDataItem = postData?.[0]?.data?.children?.[0]?.data;
    if (!postDataItem) {
      throw {
        code: 500,
        message: "Reddit API returned unexpected structure",
      };
    }
    const authorName = postDataItem.author;
    if (!authorName) {
      throw {
        code: 500,
        message: "Reddit post missing author information",
      };
    }
    const profileResp = await fetchReddit(`/user/${authorName}/about.json?raw_json=1`, env);
    if (!profileResp.ok) {
      throw {
        code: profileResp.status,
        message: profileResp.statusText,
      };
    }
    // SAFETY: response uses Reddit's profile contract.
    const { data: profileData } = (await profileResp.json()) as RedditProfileResponse;
    if (!profileData) {
      throw {
        code: 500,
        message: "Reddit profile API returned unexpected structure",
      };
    }
    return { ...postDataItem, profile: profileData };
  },
  async transform(raw) {
    return {
      platform: this.type,
      author: {
        name: raw.subreddit_name_prefixed,
        avatar: raw.profile.icon_img,
        handle: raw.author,
        url: `https://reddit.com/user/${raw.author}`,
      },
      timestamp: raw.created_utc,
      url: `https://reddit.com/${raw.permalink}`,
      text: `### ${raw.title}\n${raw.selftext}`,
      media: parseMedia(raw),
      stats: {
        comments: raw.num_comments,
        likes: raw.ups,
      },
    };
  },
} as const;
