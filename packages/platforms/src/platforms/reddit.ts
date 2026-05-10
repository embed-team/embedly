import { NormalizedPost, Platform } from "../types";

const MATCH_RE =
  /^(?:https?:\/\/)?(?:www\.|old\.)?(?:reddit\.com\/r\/[A-Za-z0-9_]+\/(?:comments\/[A-Za-z0-9]+(?:\/[^/\s]+)?|s\/[A-Za-z0-9]+)|redd\.it\/[A-Za-z0-9]+)\/?/;
const FOLLOWUP_RE =
  /^(?:https?:\/\/)?(?:www\.|old\.|m\.)?reddit\.com\/r\/(?<subreddit>\w+)\/comments\/(?<post_id>[a-z0-9]+)/;

function parseMedia(raw: Record<string, any>): NormalizedPost["media"] {
  if (raw.domain === "i.redd.it") {
    return [
      {
        url: raw.url_overridden_by_dest,
        type: "photo",
      },
    ];
  }

  if (raw.media_metadata) {
    return Object.values(raw.media_metadata).map((media: any) => ({
      url: media.s.u,
      type: "unknown",
    }));
  }

  if (raw.preview?.enabled) {
    return raw.preview.images.map((media: any) => ({
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

export const Reddit: Platform<"Reddit", Record<string, any>, {}> = {
  type: "Reddit",
  async match(url, env) {
    const match = url.match(MATCH_RE);
    if (!match) return Promise.reject();
    const req = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": env?.EMBED_USER_AGENT ?? "curl/8.7.1",
      },
    });

    const groups = req.url.match(FOLLOWUP_RE)?.groups;
    if (!groups) return null;
    const { subreddit, post_id } = groups;
    return `${subreddit}/${post_id}`;
  },
  async fetch(id, env) {
    const [subreddit, reddit_id] = id.split("/");
    const url = `https://www.reddit.com/r/${subreddit}/comments/${reddit_id}.json?raw_json=1`;
    const postResp = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": env?.EMBED_USER_AGENT ?? "curl/8.7.1",
      },
    });

    if (!postResp.ok) {
      throw { code: postResp.status, message: postResp.statusText };
    }

    const postData = (await postResp.json()) as Record<string, any>;
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
    const profileResp = await fetch(
      `https://www.reddit.com/user/${authorName}/about.json?raw_json=1`,
      {
        method: "GET",
        headers: {
          "User-Agent": env?.EMBED_USER_AGENT ?? "",
        },
      },
    );
    if (!profileResp.ok) {
      throw {
        code: profileResp.status,
        message: profileResp.statusText,
      };
    }
    const { data: profileData } = (await profileResp.json()) as Record<string, any>;
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
