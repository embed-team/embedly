export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogValue = string | number | boolean | null | undefined;
export type LogContext = Record<string, LogValue>;

export interface ErrorContext {
  error_name?: string;
  error_message?: string;
  upstream_status?: LogValue;
  upstream_message?: LogValue;
  upstream_reason?: LogValue;
}

export interface EmbedlyEvent {
  type: string;
  title: string;
  detail: string;
}

export interface EmbedlyErrorEvent extends EmbedlyEvent {
  status: 400 | 401 | 403 | 404 | 500 | 502;
}

export interface EmbedlyProblem {
  type: string;
  title: string;
  detail: string;
  status: EmbedlyErrorEvent["status"];
  request_id: string;
  context?: Record<string, string | number | boolean>;
}

export function defineLog(event: EmbedlyEvent) {
  return event;
}

export function defineError(event: EmbedlyErrorEvent) {
  return event;
}

export const EmbedlyErrors = {
  NoUrlsFound: defineError({
    type: "embed.no_urls_found",
    title: "No URLs Found.",
    detail: "No links were found in the message.",
    status: 400,
  }),
  NoMatchesFound: defineError({
    type: "embed.no_matches_found",
    title: "No Matches Found.",
    detail: "No supported Embedly links were found.",
    status: 400,
  }),
  NoMediaFound: defineError({
    type: "embed.no_media_found",
    title: "No Media Found.",
    detail: "That post did not have media to display.",
    status: 400,
  }),
  PlatformFetchFailed: defineError({
    type: "platform.fetch_failed",
    title: "Failed to fetch post.",
    detail: "Embedly could not fetch that post from the platform.",
    status: 502,
  }),
  InstagramAgeRestricted: defineError({
    type: "instagram.age_restricted",
    title: "Age-restricted content.",
    detail: "Instagram requires login to view this post. Embedly can only access public posts.",
    status: 403,
  }),
  InstagramPostUnavailable: defineError({
    type: "instagram.post_unavailable",
    title: "Post unavailable.",
    detail: "Instagram isn't making this post available without login.",
    status: 404,
  }),
  InstagramMediaUnavailable: defineError({
    type: "platform.fetch_failed",
    title: "Couldn't load this post.",
    detail:
      "Instagram didn't provide public media for this post. It may require login or be unavailable.",
    status: 502,
  }),
  PlatformTransformFailed: defineError({
    type: "platform.transform_failed",
    title: "Failed to build post data.",
    detail: "Embedly could not prepare that post for Discord.",
    status: 500,
  }),
  CacheReadFailed: defineError({
    type: "cache.read_failed",
    title: "Failed to read cache.",
    detail: "Embedly could not read cached post data.",
    status: 500,
  }),
  CacheWriteFailed: defineError({
    type: "cache.write_failed",
    title: "Failed to write cache.",
    detail: "Embedly fetched the post but could not cache it.",
    status: 500,
  }),
  ApiUnexpectedResponse: defineError({
    type: "api.unexpected_response",
    title: "Unexpected API response.",
    detail: "Embedly received an unexpected response from its API.",
    status: 500,
  }),
  DiscordSendFailed: defineError({
    type: "discord.send_failed",
    title: "Failed to send message.",
    detail: "Embedly could not send a response to Discord.",
    status: 500,
  }),
  DeleteFailed: defineError({
    type: "discord.delete_failed",
    title: "Deletion Failed.",
    detail:
      "Failed to delete the message.\n-# (This only works if you are the original poster or have `Manage Messages` permission.)",
    status: 403,
  }),
  MessageCacheFailed: defineError({
    type: "message_cache.failed",
    title: "Message cache failed.",
    detail: "Embedly could not update the message cache.",
    status: 500,
  }),
  EmojiUploadFailed: defineError({
    type: "emoji.upload_failed",
    title: "Emoji upload failed.",
    detail: "Embedly could not upload an application emoji.",
    status: 500,
  }),
} as const;

export const EmbedlyLogs = {
  ApiCacheHit: defineLog({
    type: "api.cache_hit",
    title: "Cache hit.",
    detail: "Found cached post data.",
  }),
  ApiCacheStore: defineLog({
    type: "api.cache_store",
    title: "Cache store.",
    detail: "Stored post data in cache.",
  }),
  ApiScrape: defineLog({
    type: "api.scrape",
    title: "API scrape.",
    detail: "Handled API scrape request.",
  }),
  EmbedRequest: defineLog({
    type: "embed.request",
    title: "Embed request.",
    detail: "Handled embed request.",
  }),
  EmbedCreated: defineLog({
    type: "embed.created",
    title: "Embed created.",
    detail: "Created an Embedly response.",
  }),
  DeleteRequest: defineLog({
    type: "discord.delete_request",
    title: "Delete request.",
    detail: "Handled delete request.",
  }),
  EmbedSkipped: defineLog({
    type: "embed.skipped",
    title: "Embed skipped.",
    detail: "Skipped an Embedly response.",
  }),
  DeleteSucceeded: defineLog({
    type: "discord.delete_succeeded",
    title: "Embed deleted.",
    detail: "Deleted an Embedly response.",
  }),
  AutoDeleteSucceeded: defineLog({
    type: "discord.auto_delete_succeeded",
    title: "Embed auto-deleted.",
    detail: "Deleted Embedly responses for a deleted source message.",
  }),
} as const;

export function createProblem(
  event: EmbedlyErrorEvent,
  {
    request_id,
    context,
    detail,
    status,
  }: {
    request_id: string;
    context?: LogContext;
    detail?: string;
    status?: EmbedlyErrorEvent["status"];
  },
): EmbedlyProblem {
  const safeContext = getSafeContext(context);
  const problem: EmbedlyProblem = {
    type: event.type,
    title: event.title,
    detail: detail ?? event.detail,
    status: status ?? event.status,
    request_id,
  };
  if (Object.keys(safeContext).length > 0) problem.context = safeContext;
  return problem;
}

/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof -- External response validation requires runtime checks. */
export function isEmbedlyProblem(value: unknown): value is EmbedlyProblem {
  if (!value || typeof value !== "object") return false;
  return (
    "type" in value &&
    typeof value.type === "string" &&
    "title" in value &&
    typeof value.title === "string" &&
    "detail" in value &&
    typeof value.detail === "string" &&
    "status" in value &&
    typeof value.status === "number" &&
    "request_id" in value &&
    typeof value.request_id === "string"
  );
}
/* oxlint-enable anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof */

export function formatDiscordError(problem: EmbedlyProblem) {
  return `**__${problem.title}__**\n${problem.detail}\n\n-# ${problem.type} - ${problem.request_id}`;
}

export function formatLog(_level: LogLevel, event: EmbedlyEvent, context?: LogContext) {
  const parts = [
    event.detail,
    `type=${event.type}`,
    ...Object.entries(getSafeContext(context)).map(
      ([key, value]) => `${key}=${formatValue(value)}`,
    ),
  ];
  return parts.join(" ");
}

export function formatProblemLog(level: LogLevel, problem: EmbedlyProblem) {
  return formatLog(
    level,
    {
      type: problem.type,
      title: problem.title,
      detail: problem.detail,
    },
    {
      request_id: problem.request_id,
      status: problem.status,
      ...problem.context,
    },
  );
}

/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof -- Thrown values have no contract. */
export function getErrorContext(error: unknown): ErrorContext {
  if (error instanceof Error) {
    return {
      error_name: error.name,
      error_message: error.message,
    };
  }

  if (error && typeof error === "object") {
    const context: ErrorContext = {};
    if ("code" in error) context.upstream_status = toLogValue(error.code);
    if ("status" in error) context.upstream_status = toLogValue(error.status);
    if ("message" in error) context.upstream_message = toLogValue(error.message);
    if ("reason" in error) context.upstream_reason = toLogValue(error.reason);
    return context;
  }

  return {
    error_message: String(error),
  };
}
/* oxlint-enable anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof */

export function getRequestId(request: Request) {
  return request.headers.get("X-Embedly-Request-Id") ?? `request:${crypto.randomUUID()}`;
}

function getSafeContext(context?: LogContext) {
  const safeContext: Record<string, string | number | boolean> = {};
  if (!context) return safeContext;

  for (const [key, value] of Object.entries(context)) {
    if (value === undefined || value === null) continue;
    safeContext[key] = value;
  }

  return safeContext;
}

function formatValue(value: string | number | boolean) {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Non-string log values need serialization.
  if (typeof value !== "string") return String(value);
  if (/^[A-Za-z0-9._:@/-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof -- External error properties need runtime normalization. */
function toLogValue(value: unknown): LogValue {
  if (value === undefined || value === null) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return String(value);
}
/* oxlint-enable anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof */
