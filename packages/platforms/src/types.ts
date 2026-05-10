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
  media: Array<{ url: string; type: string }>;
  quote?: NormalizedPost;
  reply_to?: NormalizedPost;
}

interface FetchEnv {
  EMBED_USER_AGENT: string;
}

export interface Platform<PlatformName extends string, PlatformData, PlatformMeta> {
  readonly type: PlatformName;
  match(url: string, env?: FetchEnv): Promise<string | null>;
  fetch(id: string, env?: FetchEnv): Promise<PlatformData>;
  transform(raw: PlatformData): Promise<NormalizedPost & PlatformMeta & { platform: PlatformName }>;
}
