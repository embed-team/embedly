import { EmbedlyErrors, EmbedlyLogs, formatLog, getErrorContext } from "@embedly/logging";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { parseMusicURL, type MusicLinks } from "./client";
import { UpstreamError } from "./http";
import { resolveMusic } from "./resolve";

const app = new Hono<{ Bindings: CloudflareBindings }>()
  .use("/v1/*", cors({ origin: "*", allowMethods: ["GET", "OPTIONS"] }))
  .get("/v1/links", async (c) => {
    const url = c.req.query("url");
    const ref = url && url.length <= 2048 ? parseMusicURL(url) : null;
    if (!ref)
      return c.json(
        {
          error: "invalid_url",
          message: "Provide a Spotify, Apple Music, Tidal, or Amazon Music track or album URL.",
        },
        400,
      );
    const started = Date.now();
    const force =
      c.req
        .header("Cache-Control")
        ?.split(",")
        .map((value) => value.trim())
        .includes("no-cache") ?? false;
    const cached = force
      ? null
      : await c.env.CACHE.get<MusicLinks>(`v1:${ref.provider}:${ref.type}:${ref.id}`, "json");
    const data = cached ? { ...cached, source: ref } : await resolveMusic(ref, c.env, force);
    console.info(
      formatLog("info", EmbedlyLogs.ApiScrape, {
        source: "music",
        platform: ref.provider,
        post_id: ref.id,
        cache_status: cached ? "hit" : "miss",
        status_code: 200,
        duration_ms: Date.now() - started,
      }),
    );
    return c.json(data);
  })
  .onError((error, c) => {
    console.error(
      formatLog("error", EmbedlyErrors.PlatformFetchFailed, {
        source: "music",
        ...getErrorContext(error),
      }),
    );
    if (error instanceof UpstreamError && error.status === 404)
      return c.json(
        { error: "not_found", message: "The source track or album was not found." },
        404,
      );
    return c.json(
      { error: "source_unavailable", message: "Could not resolve the source track or album." },
      502,
    );
  });

export default app;
