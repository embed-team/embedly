export interface RedditAccessTokenResponse {
  access_token?: string;
}

export interface RedditMediaMetadata {
  s: { u: string };
}

export interface RedditPostData {
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

export interface RedditProfile {
  icon_img: string;
}

export interface RedditPost extends RedditPostData {
  profile: RedditProfile;
}

export interface RedditListing {
  data?: {
    children?: Array<{ data?: RedditPostData }>;
  };
}

export interface RedditProfileResponse {
  data?: RedditProfile;
}
