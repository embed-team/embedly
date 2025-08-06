import type { Embed } from "@embedly/builder";
import type {
  EmbedlyErrorBase,
  EmbedlyInteractionContext,
  EmbedlyPostContext
} from "@embedly/logging";
import type {
  BaseEmbedData,
  EmbedlyPlatformType
} from "@embedly/types";

export interface EmbedlyPlatformLogMessages {
  fetching: EmbedlyErrorBase<EmbedlyPostContext>;
  failed: EmbedlyErrorBase<
    EmbedlyInteractionContext & EmbedlyPostContext
  >;
}
export abstract class EmbedlyPlatform {
  constructor(
    public name: EmbedlyPlatformType,
    private cache_prefix: string,
    public log_messages: EmbedlyPlatformLogMessages
  ) {}

  abstract parsePostId(url: string): string;
  public async getPostFromCache(
    post_id: string,
    cache_store: KVNamespace
  ) {
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
  ) {
    const cache_key = `${this.cache_prefix}:${post_id}`;
    cache_store.put(cache_key, JSON.stringify(post_data), {
      expirationTtl: 60 * 60 * 24
    });
  }
  abstract fetchPost<T>(post_id: string, env?: any): Promise<T>;
  abstract transformRawData(raw_data: any): BaseEmbedData;
  abstract createEmbed<T>(post_data: T): Embed;
}
