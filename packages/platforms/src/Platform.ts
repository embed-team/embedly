import type { BaseEmbedData } from "@embedly/builder";
import {
  EMBEDLY_FAILED_PLATFORM,
  EMBEDLY_FETCH_PLATFORM,
  type EmbedlyErrorBase,
  type EmbedlyInteractionContext,
  type EmbedlyPostContext
} from "@embedly/logging";
import type { EmbedlyPlatformType } from "./types.ts";

// Re-export for convenience
export type { BaseEmbedData } from "@embedly/builder";

export interface EmbedlyPlatformLogMessages {
  fetching: EmbedlyErrorBase<EmbedlyPostContext>;
  failed: EmbedlyErrorBase<
    EmbedlyInteractionContext & EmbedlyPostContext
  >;
}

export interface CloudflareEnv {
  EMBED_USER_AGENT: string;
  THREADS_CSRF_TOKEN?: string;
  STORAGE: KVNamespace;
  BETTERSTACK_SOURCE_TOKEN: string;
  BETTERSTACK_INGESTING_HOST: string;
  DISCORD_BOT_TOKEN: string;
}

export abstract class EmbedlyPlatform {
  // Config properties - each platform must define these
  abstract readonly color: readonly [number, number, number];
  abstract readonly emoji: string;
  abstract readonly regex: RegExp;

  // Auto-generated log messages
  public log_messages: EmbedlyPlatformLogMessages;

  constructor(
    public name: EmbedlyPlatformType,
    private cache_prefix: string
  ) {
    // Auto-generate log messages from platform name
    this.log_messages = {
      fetching: EMBEDLY_FETCH_PLATFORM(name),
      failed: EMBEDLY_FAILED_PLATFORM(name)
    };
  }

  /**
   * Test if a URL matches this platform's regex
   */
  public matchesUrl(url: string): boolean {
    return this.regex.test(url);
  }

  abstract parsePostId(url: string): Promise<string>;

  public async getPostFromCache(
    post_id: string,
    cache_store: KVNamespace
  ): Promise<Record<string, any> | null> {
    const cache_key = `${this.cache_prefix}:${post_id}`;
    return await cache_store.get<Record<string, any>>(cache_key, {
      cacheTtl: 60 * 60 * 24,
      type: "json"
    });
  }

  public async addPostToCache(
    post_id: string,
    post_data: any,
    cache_store: KVNamespace
  ): Promise<void> {
    const cache_key = `${this.cache_prefix}:${post_id}`;
    cache_store.put(cache_key, JSON.stringify(post_data), {
      expirationTtl: 60 * 60 * 24
    });
  }

  // env is optional and partial - each platform uses what it needs
  abstract fetchPost<T>(
    post_id: string,
    env?: Partial<CloudflareEnv>
  ): Promise<T>;
  abstract transformRawData(
    raw_data: any
  ): Promise<BaseEmbedData> | BaseEmbedData;
  abstract createEmbed<T>(post_data: T): Promise<any> | any;
}
