import type * as platforms from "./platforms";
export type PlatformType = (typeof platforms)[keyof typeof platforms]["type"];
export interface NormalizedPost {
  platform: PlatformType;
  author: {
    name: string;
    handle?: string;
    url?: string;
    avatar: string;
  };
  url: string;
  text?: string;
  timestamp: number;
  stats?: {
    comments?: number;
    reposts?: number;
    likes?: number;
    bookmarks?: number;
    views?: number;
  };
  media: Array<{ url: string; type: string; description?: string }>;
  quote?: NormalizedPost;
  reply_to?: NormalizedPost;
}

interface TransformOptions {
  depth?: number;
}

interface FetchEnv {
  EMBED_USER_AGENT: string;
  REDDIT_CLIENT_ID?: string;
  REDDIT_CLIENT_SECRET?: string;
}

export interface Platform<PlatformName extends string, PlatformData, PlatformMeta> {
  readonly type: PlatformName;
  match(url: string, env?: FetchEnv): Promise<string | null>;
  fetch(id: string, env?: FetchEnv): Promise<PlatformData>;
  transform(
    raw: PlatformData,
    options?: TransformOptions,
  ): Promise<NormalizedPost & PlatformMeta & { platform: PlatformName }>;
}
