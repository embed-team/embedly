import { Platforms } from "@embedly/platforms";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import z from "zod";

import { version } from "../package.json";

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
    zValidator("json", z.object({ platform: z.string(), id: z.string() })),
    async (c) => {
      const { id, platform } = c.req.valid("json");
      try {
        // oxlint-disable-next-line import/namespace
        const p = Platforms[platform as keyof typeof Platforms];
        const raw = await p.fetch(id, { EMBED_USER_AGENT: c.env.EMBED_USER_AGENT });
        const data = await p.transform(raw as any);
        return c.json(data, 200);
      } catch (cause) {
        console.log(platform, id, cause);
        throw new HTTPException(500, {
          cause,
          message: JSON.stringify({ message: `Failed to fetch ${platform}(${id})` }),
        });
      }
    },
  );

export default app;
export type AppType = typeof app;
