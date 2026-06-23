import {
  createProblem,
  EmbedlyErrors,
  EmbedlyLogs,
  formatLog,
  getErrorContext,
  getRequestId,
} from "@embedly/logging";
import { Platforms } from "@embedly/platforms";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { cors } from "hono/cors";
import { prettyJSON } from "hono/pretty-json";
import z from "zod";

import { version } from "../package.json";

type ScrapeResponse = Awaited<ReturnType<(typeof Platforms)[keyof typeof Platforms]["transform"]>>;

function getTraceId(request: Request) {
  const traceparent = request.headers.get("traceparent");
  const traceId = traceparent?.split("-")[1];
  if (!traceId || !/^[a-f0-9]{32}$/.test(traceId)) return undefined;
  return traceId;
}

const app = new Hono<{ Bindings: CloudflareBindings }>()
  .use(cors())
  .use(prettyJSON())
  .get("/health", (c) => {
    return c.json({ version }, 200);
  })
  .use("/platforms/scrape", (c, next) => {
    const bearer = bearerAuth({ token: c.env.AUTH_SECRET });
    return bearer(c, next);
  })
  .post(
    "/platforms/scrape",
    zValidator(
      "json",
      z.object({ platform: z.string(), id: z.string(), force: z.boolean().optional() }),
    ),
    async (c) => {
      const startedAt = Date.now();
      const { id, platform, force } = c.req.valid("json");
      const requestId = getRequestId(c.req.raw);
      const logContext: Record<string, unknown> = {
        request_id: requestId,
        trace_id: getTraceId(c.req.raw),
        source: c.req.header("X-Embedly-Source") ?? "api",
        platform,
        post_id: id,
        force: force ?? false,
        cache_status: force ? "skipped" : "miss",
        outcome: "success",
        status_code: 200,
      };

      try {
        const cache = c.env.CACHE;
        const cacheKey = `${platform}:${id}`;
        if (!force) {
          try {
            const cachedItem = await cache.get<ScrapeResponse>(cacheKey, "json");
            if (cachedItem) {
              logContext.cache_status = "hit";
              return c.json(cachedItem as ScrapeResponse, 200);
            }
          } catch (cause) {
            const problem = createProblem(EmbedlyErrors.CacheReadFailed, {
              request_id: requestId,
              context: { ...logContext, ...getErrorContext(cause) },
            });
            Object.assign(logContext, getErrorContext(cause), {
              outcome: "error",
              status_code: problem.status,
              error_type: problem.type,
            });
            return c.json(problem, problem.status);
          }
        }

        // oxlint-disable-next-line import/namespace
        const p = Platforms[platform as keyof typeof Platforms];
        if (!p) {
          const problem = createProblem(EmbedlyErrors.NoMatchesFound, {
            request_id: requestId,
            context: logContext,
            detail: `No supported platform matched ${platform}.`,
          });
          Object.assign(logContext, {
            outcome: "error",
            status_code: problem.status,
            error_type: problem.type,
          });
          return c.json(problem, problem.status);
        }

        let raw: unknown;
        try {
          raw = await p.fetch(id, {
            EMBED_USER_AGENT: c.env.EMBED_USER_AGENT,
            REDDIT_CLIENT_ID: c.env.REDDIT_CLIENT_ID,
            REDDIT_CLIENT_SECRET: c.env.REDDIT_CLIENT_SECRET,
          });
        } catch (cause) {
          const problem = createProblem(EmbedlyErrors.PlatformFetchFailed, {
            request_id: requestId,
            context: { ...logContext, ...getErrorContext(cause) },
          });
          Object.assign(logContext, getErrorContext(cause), {
            outcome: "error",
            status_code: problem.status,
            error_type: problem.type,
          });
          return c.json(problem, problem.status);
        }

        let data: ScrapeResponse;
        try {
          data = await p.transform(raw as any);
        } catch (cause) {
          const problem = createProblem(EmbedlyErrors.PlatformTransformFailed, {
            request_id: requestId,
            context: { ...logContext, ...getErrorContext(cause) },
          });
          Object.assign(logContext, getErrorContext(cause), {
            outcome: "error",
            status_code: problem.status,
            error_type: problem.type,
          });
          return c.json(problem, problem.status);
        }

        try {
          await cache.put(cacheKey, JSON.stringify(data), {
            expirationTtl: 60 * 60 * 24,
          });
          logContext.cache_status = "stored";
        } catch (cause) {
          const problem = createProblem(EmbedlyErrors.CacheWriteFailed, {
            request_id: requestId,
            context: { ...logContext, ...getErrorContext(cause) },
          });
          Object.assign(logContext, getErrorContext(cause), {
            outcome: "error",
            status_code: problem.status,
            error_type: problem.type,
          });
          return c.json(problem, problem.status);
        }

        return c.json(data, 200);
      } catch (cause) {
        const problem = createProblem(EmbedlyErrors.ApiUnexpectedResponse, {
          request_id: requestId,
          context: { ...logContext, ...getErrorContext(cause) },
        });
        Object.assign(logContext, getErrorContext(cause), {
          outcome: "error",
          status_code: problem.status,
          error_type: problem.type,
        });
        return c.json(problem, problem.status);
      } finally {
        logContext.duration_ms = Date.now() - startedAt;
        const level = logContext.outcome === "success" ? "info" : "error";
        console[level](formatLog(level, EmbedlyLogs.ApiScrape, logContext));
      }
    },
  );

export default app;
export type AppType = typeof app;
