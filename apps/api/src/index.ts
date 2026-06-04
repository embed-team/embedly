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
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import z from "zod";

import { version } from "../package.json";

type ScrapeResponse = Awaited<ReturnType<(typeof Platforms)[keyof typeof Platforms]["transform"]>>;

const app = new Hono<{ Bindings: CloudflareBindings }>()
  .use(cors())
  .use(logger())
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
      const { id, platform, force } = c.req.valid("json");
      const requestId = getRequestId(c.req.raw);
      const logContext = {
        request_id: requestId,
        source: c.req.header("X-Embedly-Source") ?? "api",
        platform,
        post_id: id,
      };

      try {
        const cache = c.env.CACHE;
        const cacheKey = `${platform}:${id}`;
        if (!force) {
          try {
            const cachedItem = await cache.get<ScrapeResponse>(cacheKey, "json");
            if (cachedItem) {
              console.info(formatLog("info", EmbedlyLogs.ApiCacheHit, logContext));
              return c.json(cachedItem as ScrapeResponse, 200);
            }
          } catch (cause) {
            const problem = createProblem(EmbedlyErrors.CacheReadFailed, {
              request_id: requestId,
              context: { ...logContext, ...getErrorContext(cause) },
            });
            console.error(formatLog("error", EmbedlyErrors.CacheReadFailed, problem.context));
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
          console.warn(formatLog("warn", EmbedlyErrors.NoMatchesFound, problem.context));
          return c.json(problem, problem.status);
        }

        let raw: unknown;
        try {
          raw = await p.fetch(id, { EMBED_USER_AGENT: c.env.EMBED_USER_AGENT });
        } catch (cause) {
          const problem = createProblem(EmbedlyErrors.PlatformFetchFailed, {
            request_id: requestId,
            context: { ...logContext, ...getErrorContext(cause) },
          });
          console.error(formatLog("error", EmbedlyErrors.PlatformFetchFailed, problem.context));
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
          console.error(formatLog("error", EmbedlyErrors.PlatformTransformFailed, problem.context));
          return c.json(problem, problem.status);
        }

        try {
          await cache.put(cacheKey, JSON.stringify(data), {
            expirationTtl: 60 * 60 * 24,
          });
          console.info(formatLog("info", EmbedlyLogs.ApiCacheStore, logContext));
        } catch (cause) {
          const problem = createProblem(EmbedlyErrors.CacheWriteFailed, {
            request_id: requestId,
            context: { ...logContext, ...getErrorContext(cause) },
          });
          console.error(formatLog("error", EmbedlyErrors.CacheWriteFailed, problem.context));
          return c.json(problem, problem.status);
        }

        return c.json(data, 200);
      } catch (cause) {
        const problem = createProblem(EmbedlyErrors.ApiUnexpectedResponse, {
          request_id: requestId,
          context: { ...logContext, ...getErrorContext(cause) },
        });
        console.error(formatLog("error", EmbedlyErrors.ApiUnexpectedResponse, problem.context));
        return c.json(problem, problem.status);
      }
    },
  );

export default app;
export type AppType = typeof app;
