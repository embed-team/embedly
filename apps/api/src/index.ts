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

const app = new Hono<{ Bindings: CloudflareBindings }>();
app.use(cors());
app.use(logger());
app.use(prettyJSON());

app.get("/health", (c) => {
  return c.json({ version }, 200);
});

app.use("/api/scrape", (c, next) => {
  const bearer = bearerAuth({ token: c.env.AUTH_SECRET });
  return bearer(c, next);
});

app.post(
  "/api/scrape",
  zValidator("json", z.object({ platform: z.string(), id: z.string() })),
  async (c) => {
    const { id, platform } = c.req.valid("json");
    try {
      // oxlint-disable-next-line import/namespace
      const p = Platforms[platform as keyof typeof Platforms];
      const raw = await p.fetch(id);
      const data = p.transform(raw);
      return c.json(data, 200);
    } catch (cause) {
      throw new HTTPException(500, { cause, message: `Failed to fetch ${platform}(${id})` });
    }
  },
);

export default app;
