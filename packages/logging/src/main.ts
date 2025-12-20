import type { EmbedlyPlatformType } from "@embedly/types";

export interface EmbedlyLogBase<C = unknown> {
  type: string;
  title: string;
  detail: string;
  context?: C;
}

export interface EmbedlyErrorBase<C = unknown>
  extends EmbedlyLogBase<C> {
  status?: 400 | 401 | 500;
}

export const EMBEDLY_INVALID_REQUEST: EmbedlyErrorBase<{
  _req: Request;
}> = {
  type: "EMBEDLY_INVALID_REQUEST",
  status: 401,
  title: "Invalid request signature.",
  detail: "Failed to validate request from Discord."
};

export interface EmbedlyInteractionContext {
  interaction_id?: string;
  user_id?: string;
  message_id?: string;
}

export const EMBEDLY_NO_LINK_IN_MESSAGE: EmbedlyErrorBase<EmbedlyInteractionContext> =
  {
    type: "EMBEDLY_NO_LINK_IN_MESSAGE",
    status: 400,
    title: "Failed to find a link.",
    detail:
      "No link found in the message provided. Use this action on messages you want to enrich the links of."
  };

export const EMBEDLY_NO_VALID_LINK: EmbedlyErrorBase<EmbedlyInteractionContext> =
  {
    type: "EMBEDLY_NO_VALID_LINK",
    status: 400,
    title: "Failed to find a valid link.",
    detail:
      "No valid links found. Only Twitter/X, Instagram, and TikTok work at this time."
  };

export interface EmbedlyPostContext {
  platform?: EmbedlyPlatformType;
  post_url?: string;
  post_id?: string;
  resp_status?: number;
  resp_message?: string;
  resp_data?: any;
}

export const EMBEDLY_FETCH_PLATFORM: (
  platform: EmbedlyPlatformType
) => EmbedlyErrorBase<EmbedlyPostContext> = (
  platform: EmbedlyPlatformType
) => ({
  type: `EMBEDLY_FETCH_${platform.toUpperCase()}`,
  title: `Fetching ${platform}.`,
  detail: `Fetching ${platform} from the ${platform} API.`
});

export const EMBEDLY_FAILED_PLATFORM: (
  platform: EmbedlyPlatformType
) => EmbedlyErrorBase<EmbedlyInteractionContext & EmbedlyPostContext> =
  (platform: EmbedlyPlatformType) => ({
    type: `EMBEDLY_FAILED_${platform.toUpperCase()}`,
    status: 500,
    title: `Failed to fetch ${platform}.`,
    detail: `Failed to fetch this ${platform} post from the ${platform} API.`
  });

export const EMBEDLY_CACHED_POST: EmbedlyErrorBase<EmbedlyPostContext> =
  {
    type: "EMBEDLY_CACHED_POST",
    title: "Hit cache.",
    detail: "Found the post in the cache."
  };

export const EMBEDLY_CACHING_POST: EmbedlyErrorBase<EmbedlyPostContext> =
  {
    type: "EMBEDLY_CACHING_POST",
    title: "Adding to cache.",
    detail: "Adding the post to the cache."
  };

export interface EmbedlyDeferContext extends EmbedlyInteractionContext {
  platform_ctx?: EmbedlyPostContext;
  discord_error?: any;
}

export const EMBEDLY_MESSAGE_UPDATE_FAILED: EmbedlyErrorBase<EmbedlyDeferContext> =
  {
    type: "EMBEDLY_MESSAGE_UPDATE_FAILED",
    title: "Update Failed.",
    detail: "Failed to update the message."
  };

export const EMBEDLY_DELETE_FAILED: EmbedlyErrorBase<EmbedlyInteractionContext> =
  {
    type: "EMBEDLY_DELETE_FAILED",
    title: "Deletion Failed.",
    detail:
      "Failed to delete the message.\n-# (This only works if you are the original poster or have `MANAGE_MESSAGES` permission)"
  };

const DELETE_SUCCESS_MESSAGES = [
  "embed successfully yeeted into the void! ✨",
  "👋 bye bye embed! deletion complete!",
  "your embed has left the building! ✨",
  "poof~ your embed has vanished! ✨",
  "🧹 all tidy! embed removed as requested~"
];

export const EMBEDLY_DELETE_SUCCESS: EmbedlyErrorBase<EmbedlyInteractionContext> =
  {
    type: "EMBEDLY_DELETE_SUCCESS",
    title: "Deletion Successful.",
    detail:
      DELETE_SUCCESS_MESSAGES[
        ~~(DELETE_SUCCESS_MESSAGES.length * Math.random())
      ]
  };

export interface EmbedlyEmbedContext extends EmbedlyInteractionContext {
  platform?: EmbedlyPlatformType;
  url?: string;
  bot_message_id?: string;
  user_message_id?: string;
}

export const EMBEDLY_EMBED_CREATED_COMMAND: EmbedlyLogBase<EmbedlyEmbedContext> =
  {
    type: "EMBEDLY_EMBED_CREATED_COMMAND",
    title: "Embed created via command.",
    detail: "User created an embed using slash command or context menu."
  };

export const EMBEDLY_EMBED_CREATED_MESSAGE: EmbedlyLogBase<EmbedlyEmbedContext> =
  {
    type: "EMBEDLY_EMBED_CREATED_MESSAGE",
    title: "Embed created from message.",
    detail: "Embed automatically created from user message."
  };

export interface EmbedlyDeleteContext
  extends EmbedlyInteractionContext {
  original_author_id?: string;
  has_manage_permission?: boolean;
  reason?: string;
}

export const EMBEDLY_DELETE_FAILED_WARN: EmbedlyLogBase<EmbedlyDeleteContext> =
  {
    type: "EMBEDLY_DELETE_FAILED_WARN",
    title: "Deletion failed.",
    detail:
      "User attempted to delete embed but failed permission check."
  };

export const EMBEDLY_DELETE_SUCCESS_INFO: EmbedlyLogBase<EmbedlyDeleteContext> =
  {
    type: "EMBEDLY_DELETE_SUCCESS_INFO",
    title: "Embed deleted.",
    detail: "User successfully deleted an embed."
  };

export const EMBEDLY_NO_LINK_WARN: EmbedlyLogBase<EmbedlyInteractionContext> =
  {
    type: "EMBEDLY_NO_LINK_WARN",
    title: "No link found.",
    detail: "User attempted to create embed without a link."
  };

export const EMBEDLY_NO_VALID_LINK_WARN: EmbedlyLogBase<EmbedlyInteractionContext> =
  {
    type: "EMBEDLY_NO_VALID_LINK_WARN",
    title: "Invalid link platform.",
    detail: "User attempted to embed unsupported platform."
  };

export function formatBetterStack<T extends EmbedlyLogBase>(
  log: T,
  ctx: T["context"]
) {
  log.context = ctx;
  return [log.detail, log] as const;
}

export function formatDiscord<
  T extends EmbedlyErrorBase<EmbedlyInteractionContext>
>(err: T, ctx: T["context"]) {
  return `**__${err.title}__**\n${err.detail}\n\n-# [${err.type}]: ${ctx?.interaction_id || ctx?.message_id}`;
}
