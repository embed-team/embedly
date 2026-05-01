import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";

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

app.post("/api/scrape", (c) => {
  // api stub
  return c.json({}, 200);
});

export default app;
