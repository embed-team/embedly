import {
  EMBEDLY_CACHED_POST,
  EMBEDLY_CACHING_POST,
  EMBEDLY_NO_LINK_IN_MESSAGE,
  EMBEDLY_NO_VALID_LINK,
  EMBEDLY_PARSE_POST_ID_FAILED,
  type EmbedlyPostContext,
  type FormattedLog,
  formatLog
} from "@embedly/logging";
import Platforms, {
  EmbedlyPlatformType,
  GENERIC_LINK_REGEX,
  getPlatformFromURL,
  hasLink
} from "@embedly/platforms";
import {
  instrument,
  type ResolveConfigFn
} from "@microlabs/otel-cf-workers";
import {
  context,
  propagation,
  SpanStatusCode,
  trace
} from "@opentelemetry/api";
import { Elysia, t } from "elysia";

const app = (env: Env, ctx: ExecutionContext) =>
  new Elysia({ aot: false, normalize: false })
    .onError(({ set }) => {
      set.status = 500;
      return { error: "Internal server error" };
    })
    .decorate({ env, ctx })
    .derive(({ ctx, env }) => {
      const pending: {
        severityText: string;
        severityNumber: number;
        log: FormattedLog;
        timestamp: number;
        traceId: string;
        spanId: string;
      }[] = [];

      const emit = (
        severityText: string,
        severityNumber: number,
        log: FormattedLog
      ) => {
        const method = severityText.toLowerCase() as
          | "debug"
          | "info"
          | "warn"
          | "error";
        console[method]?.(log.body, log.attributes);
        const span = trace.getActiveSpan();
        const spanCtx = span?.spanContext();
        pending.push({
          severityText,
          severityNumber,
          log,
          timestamp: Date.now(),
          traceId: spanCtx?.traceId ?? "",
          spanId: spanCtx?.spanId ?? ""
        });
      };

      const flush = () => {
        if (pending.length === 0) return;
        const body = {
          resourceLogs: [
            {
              resource: {
                attributes: [
                  {
                    key: "service.name",
                    value: { stringValue: "embedly-api" }
                  }
                ]
              },
              scopeLogs: [
                {
                  scope: { name: "embedly-api" },
                  logRecords: pending.map(
                    ({
                      severityText,
                      severityNumber,
                      log,
                      timestamp,
                      traceId,
                      spanId
                    }) => ({
                      timeUnixNano: String(timestamp * 1_000_000),
                      severityNumber,
                      traceId,
                      spanId,
                      severityText,
                      body: { stringValue: log.body },
                      attributes: Object.entries(log.attributes)
                        .filter(([, v]) => v !== undefined)
                        .map(([key, value]) => ({
                          key,
                          value:
                            typeof value === "number"
                              ? { intValue: value }
                              : typeof value === "boolean"
                                ? { boolValue: value }
                                : { stringValue: String(value) }
                        }))
                    })
                  )
                }
              ]
            }
          ]
        };

        ctx.waitUntil(
          fetch(
            `${env.OTEL_ENDPOINT.replace("/v1/traces", "")}/v1/logs`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body)
            }
          ).catch(() => {})
        );
      };

      return {
        logger: {
          debug(log: FormattedLog) {
            emit("DEBUG", 5, log);
          },
          info(log: FormattedLog) {
            emit("INFO", 9, log);
          },
          warn(log: FormattedLog) {
            emit("WARN", 13, log);
          },
          error(log: FormattedLog) {
            emit("ERROR", 17, log);
          },
          flush
        }
      };
    })
    .onAfterHandle(({ logger }) => {
      logger.flush();
    })
    .guard({
      headers: t.Object(
        {
          authorization: t.Optional(t.String()),
          accept: t.Optional(t.String())
        },
        { additionalProperties: true }
      )
    })
    .macro({
      auth: {
        resolve: ({ headers, status, env }) => {
          const auth = headers.authorization;
          const bearer = auth?.startsWith("Bearer ")
            ? auth.slice(7)
            : null;
          if (!bearer) return status(401);
          if (bearer !== env.DISCORD_BOT_TOKEN) return status(401);
          return {};
        }
      }
    })
    .post(
      "/api/scrape",
      async ({
        body: { platform, url },
        status,
        logger,
        set,
        headers
      }) => {
        const carrier: Record<string, string> = {};
        Object.values(headers).forEach((value, key) => {
          carrier[key] = value;
        });

        const parent_ctx = propagation.extract(
          context.active(),
          carrier
        );
        const tracer = trace.getTracer("embedly-api");
        return await context.with(parent_ctx, async () => {
          return tracer.startActiveSpan("scrape", async (root_span) => {
            const handler =
              Platforms[platform as keyof typeof Platforms];

            root_span.setAttributes({
              "embedly.platform": platform,
              "embedly.url": url
            });

            let post_id: string;
            try {
              post_id = await tracer.startActiveSpan(
                "parse_post_id",
                async (s) => {
                  const id = await handler.parsePostId(url);
                  s.setAttribute("embedly.post_id", id);
                  s.end();
                  return id;
                }
              );
            } catch (error: any) {
              root_span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error.message
              });
              root_span.recordException(error);
              logger.error(
                formatLog(EMBEDLY_PARSE_POST_ID_FAILED, {
                  platform: handler.name,
                  post_url: url,
                  error_message: error.message,
                  error_stack: error.stack
                })
              );
              root_span.end();
              return status(400, {
                type: "EMBEDLY_INVALID_URL",
                title: "Invalid URL.",
                detail: `Failed to parse post ID from URL: ${url}`
              });
            }

            root_span.setAttribute("embedly.post_id", post_id);

            const post_log_ctx: EmbedlyPostContext = {
              platform: handler.name,
              post_url: url,
              post_id
            };
            let post_data = await tracer.startActiveSpan(
              "cache_lookup",
              async (s) => {
                const res = await handler.getPostFromCache(
                  post_id,
                  env.STORAGE
                );
                s.setAttribute("embedly.cache_hit", !!res);
                s.end();
                return res;
              }
            );

            if (!post_data) {
              logger.debug(
                formatLog(handler.log_messages.fetching, post_log_ctx)
              );

              try {
                post_data = await tracer.startActiveSpan(
                  "fetch_post",
                  async (s) => {
                    s.setAttribute("embedly.platform", handler.name);
                    try {
                      const data = await handler.fetchPost(
                        post_id,
                        env
                      );
                      s.setStatus({ code: SpanStatusCode.OK });
                      return data;
                    } catch (error: any) {
                      s.setStatus({
                        code: SpanStatusCode.ERROR,
                        message: error.message
                      });
                      s.recordException(error);
                      throw error;
                    } finally {
                      s.end();
                    }
                  }
                );
              } catch (error: any) {
                post_log_ctx.resp_status = error.code;
                post_log_ctx.resp_message = error.message;

                const err = handler.log_messages.failed;
                err.context = post_log_ctx;

                logger.error(formatLog(err, err.context));

                root_span.setStatus({
                  code: SpanStatusCode.ERROR,
                  message: error.message
                });
                root_span.end();
                return status(err.status!, err);
              }

              if (!post_data) {
                const err = handler.log_messages.failed;

                logger.error(formatLog(err, post_log_ctx));

                root_span.setStatus({
                  code: SpanStatusCode.ERROR,
                  message: err.detail
                });
                root_span.end();
                return status(err.status!, err);
              }

              if (handler.name === EmbedlyPlatformType.Instagram) {
                post_data!.url = url;
              }

              await tracer.startActiveSpan("cache_store", async (s) => {
                handler.addPostToCache(post_id, post_data, env.STORAGE);
                logger.debug(
                  formatLog(EMBEDLY_CACHING_POST, post_log_ctx)
                );
                s.end();
              });
            } else {
              logger.debug(
                formatLog(EMBEDLY_CACHED_POST, post_log_ctx)
              );
            }

            set.headers["content-type"] = "application/json";
            root_span.setStatus({ code: SpanStatusCode.OK });
            root_span.end();
            return post_data as Record<string, any>;
          });
        });
      },
      {
        body: t.Object({
          platform: t.String(),
          url: t.String()
        }),
        auth: true
      }
    )
    .post(
      "/api/url/validatate",
      async ({ body, status }) => {
        const message = body;
        if (!hasLink(message.content)) {
          const err = EMBEDLY_NO_LINK_IN_MESSAGE;
          return status(err.status!, err);
        }
        const url = GENERIC_LINK_REGEX.exec(message.content)![0];
        const platform = getPlatformFromURL(url);
        if (!platform) {
          const err = EMBEDLY_NO_VALID_LINK;
          return status(err.status!, err);
        }
        return { platform: platform.type, url: url };
      },
      {
        body: t.Object(
          { content: t.String() },
          { additionalProperties: true }
        )
      }
    )
    .get(
      "/api/_image",
      async ({ query: { url, sig }, status, env }) => {
        if (!url || !sig) {
          return status(400);
        }

        const key = await crypto.subtle.importKey(
          "raw",
          new TextEncoder().encode(env.DISCORD_BOT_TOKEN),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"]
        );

        const expected_sig = await crypto.subtle.sign(
          "HMAC",
          key,
          new TextEncoder().encode(url)
        );
        const expected_hex = Array.from(new Uint8Array(expected_sig))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        if (expected_hex !== sig) {
          return status(403);
        }
        const res = await fetch(url);
        return new Response(res.body, {
          headers: {
            "Content-Type":
              res.headers.get("Content-Type") || "image/*",
            "Cache-Control": "public, max-age=3600"
          }
        });
      }
    );

const handler = {
  fetch(req: Request, env: Env, ctx: ExecutionContext) {
    return app(env, ctx).fetch(req);
  }
} satisfies ExportedHandler<Env>;

const config: ResolveConfigFn = (env: Env) => ({
  exporter: {
    url: env.OTEL_ENDPOINT,
    headers: {}
  },
  service: {
    name: "embedly-api"
  }
});

export default instrument(handler, config);

export type App = ReturnType<typeof app>;
