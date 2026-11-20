import type * as platforms from "./platforms";

export interface PlatformHTMLRewriter {
  on(
    selector: string,
    handlers: {
      element?(element: {
        getAttribute(name: string): string | null;
        onEndTag(handler: () => void): void;
      }): void;
      text?(chunk: { text: string }): void;
    },
  ): PlatformHTMLRewriter;
  transform(response: Response): Response;
}

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
  MUSIC_FETCH: typeof fetch;
  EMBED_USER_AGENT: string;
  INSTAGRAM_FETCH?: typeof fetch;
  INSTAGRAM_COOKIE?: string;
  FACEBOOK_MARKETPLACE_COOKIE?: string;
  TRUTH_SOCIAL_ACCESS_TOKEN?: string;
  REDDIT_COOKIE?: string;
}

export interface Platform<PlatformName extends string, PlatformData, PlatformMeta> {
  readonly type: PlatformName;
  match(url: string, env?: FetchEnv): Promise<string | null>;
  fetch(id: string, env?: FetchEnv): Promise<PlatformData>;
  transform(
    raw: PlatformData,
    options?: TransformOptions,
  ): Promise<Omit<NormalizedPost, "platform"> & PlatformMeta & { platform: PlatformName }>;
}
