export interface FxTweetResponse {
  code: number;
  status: APITwitterStatus | Tombstone | null;
}

export interface APITwitterStatus {
  type: "status";
  id: string;
  url: string;
  text: string;
  created_at: string;
  created_timestamp: number;
  likes: number;
  reposts: number;
  quotes: number;
  replies: number;
  possibly_sensitive: boolean;
  provider: "twitter";
  author: Profile;
  quote?: APITwitterStatus | Tombstone;
  media?: MediaContainer;
  raw_text?: RawText;
  lang?: string | null;
  translation?: Translation;
  replying_to?: ReplyingTo;
  source?: string | null;
  embed_card?: "tweet" | "summary" | "summary_large_image" | "player";
  views?: number | null;
  bookmarks?: number | null;
  community?: Community;
  article?: Article;
  at_uri?: string;
  cid?: string;
  poll?: Poll;
  thread?: (APITwitterStatus | Tombstone)[] | null;
  reposted_by?: RepostedBy;
  card?: Card;
}

export interface Tombstone {
  type: "tombstone";
  provider: "twitter" | "bluesky" | "mastodon" | "tiktok";
  reason: "deleted" | "suspended" | "private" | "blocked" | "unavailable";
  message: string;
  id?: string;
  url?: string;
  author?: Profile;
}

export interface Profile {
  type: "profile";
  id: string;
  name: string;
  screen_name: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  description: string;
  raw_description: {
    text: string;
    facets: Facet[];
  };
  location: string;
  url: string;
  protected: boolean;
  followers: number;
  following: number;
  statuses: number;
  media_count: number;
  likes: number;
  joined: string;
  website?: { url: string; display_url: string };
  birthday?: { day: number; month: number; year: number };
  verification: {
    verified: boolean;
    type?: "organization" | "government" | "individual" | null;
    verified_at?: string | null;
    identity_verified: boolean;
    verified_by?: string;
  };
  about_account?: {
    based_in?: string | null;
    location_accurate: boolean;
    created_country_accurate?: boolean | null;
    source?: string | null;
    username_changes: {
      count: number;
      last_changed_at?: string | null;
    };
  };
  profile_embed: boolean;
}

export interface Facet {
  type: "url" | "mention" | "hashtag" | "bold" | "media" | "custom_emoji" | (string & {});
  indices: [number, number];
  original?: string;
  replacement?: string;
  display?: string;
  id?: string;
}

export interface MediaContainer {
  external?: {
    type: "video";
    url: string;
    thumbnail_url?: string;
    height?: number;
    width?: number;
  };
  photos?: Photo[];
  videos?: Video[];
  all?: (Photo | Video | MosaicPhoto | UnknownMedia)[];
  mosaic?: MosaicPhoto;
  broadcast?: Broadcast;
}

export interface Photo {
  id?: string;
  format?: string;
  type: "photo" | "gif";
  url: string;
  width: number;
  height: number;
  transcode_url?: string | null;
  altText?: string;
}

export interface VideoFormat {
  container?: "mp4" | "webm" | "m3u8";
  codec?: "h264" | "hevc" | "vp9" | "av1";
  bitrate?: number;
  url: string;
  size?: number;
  height?: number;
  width?: number;
}

export interface Video {
  id?: string;
  format?: string;
  type: "video" | "gif";
  url: string;
  width: number;
  height: number;
  thumbnail_url?: string | null;
  transcode_url?: string | null;
  duration: number;
  filesize?: number;
  formats: VideoFormat[];
  publisher?: Profile;
}

export interface MosaicPhoto {
  id?: string;
  format?: string;
  type: "mosaic_photo";
  url: string;
  width: number;
  height: number;
  formats: {
    webp: string;
    jpeg: string;
  };
}

export interface UnknownMedia {
  type: string;
  url?: string;
  [key: string]: unknown;
}

export interface BroadcastThumbnail {
  original: { url: string };
  small?: { url: string };
  medium?: { url: string };
  large?: { url: string };
  x_large?: { url: string };
}

export interface Broadcast {
  url: string;
  width: number;
  height: number;
  state: "LIVE" | "ENDED";
  broadcaster: {
    username: string;
    display_name: string;
    id: string;
  };
  stream: {
    url: string;
    title: string;
    source: string;
    orientation: "landscape" | "portrait";
  };
  broadcast_id: string;
  media_id: string;
  media_key: string;
  is_high_latency: boolean;
  thumbnail: BroadcastThumbnail;
}

export interface RawText {
  text: string;
  display_text_range: [number, number];
  facets: Facet[];
}

export interface Translation {
  text: string;
  source_lang: string;
  source_lang_en: string;
  target_lang: string;
  provider: string;
}

export interface ReplyingTo {
  screen_name: string;
  status: string;
  url?: string;
  profile_url?: string;
  display_name?: string;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  created_at: string;
  search_tags: string[];
  is_nsfw: boolean;
  topic?: string | null;
  admin: Profile;
  creator: Profile;
  join_policy: "Open" | "Closed";
  invites_policy: "MemberInvitesAllowed" | "MemberInvitesDisabled";
  is_pinned: boolean;
}

export interface Article {
  created_at: string;
  modified_at?: string;
  id: string;
  title: string;
  preview_text: string;
  cover_media: {
    id: string;
    media_key: string;
    media_id: string;
    media_info: unknown;
  };
  content: {
    blocks: Array<{
      key: string;
      data: Record<string, unknown>;
    }>;
    entityMap: unknown[];
  };
  media_entities: unknown[];
  is_note_tweet: boolean;
}

export interface PollChoice {
  label: string;
  count: number;
  percentage: number;
}

export interface Poll {
  choices: PollChoice[];
  total_votes: number;
  ends_at: string;
  time_left_en: string;
}

export interface RepostedBy {
  id: string;
  name: string;
  screen_name: string;
  avatar_url?: string | null;
  url?: string;
}

export interface Card {
  url: string;
  title?: string;
  description?: string;
  domain?: string;
  card_name?: string;
  image?: {
    width?: number;
    height?: number;
    url?: string;
    alt?: string;
  };
}
