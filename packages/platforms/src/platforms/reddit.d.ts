export interface RedditMediaMetadata {
  status?: string;
  e?: "Image" | "AnimatedImage" | string;
  s: {
    u?: string;
    gif?: string;
  };
}

export interface RedditPostData {
  author?: string | null;
  subreddit_name_prefixed: string;
  created_utc: number;
  permalink: string;
  title: string;
  selftext: string;
  num_comments: number;
  ups: number;
  domain?: string;
  post_hint?: string;
  url?: string;
  url_overridden_by_dest?: string;
  thumbnail?: string;
  gallery_data?: {
    items: Array<{ media_id: string }>;
  };
  media_metadata?: Record<string, RedditMediaMetadata>;
  preview?: {
    enabled?: boolean;
    images: Array<{ source: { url: string } }>;
  };
  media?: {
    reddit_video?: {
      fallback_url: string;
      has_audio?: boolean;
      is_gif?: boolean;
      hls_url?: string;
    };
  };
}

export interface RedditPost extends RedditPostData {
  author: string;
  profile: { icon_img: string };
}

export interface RedditListing {
  data?: {
    children?: Array<{ data?: RedditPostData }>;
  };
}

export interface RedditProfileResponse {
  data?: { icon_img?: string };
}
