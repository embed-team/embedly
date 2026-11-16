import { EmbedlyErrors, EmbedlyLogs, formatLog, getErrorContext } from "@embedly/logging";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { html } from "hono/html";

import { parseMusicURL, type MusicLinks } from "./client";
import { deezerPreview } from "./deezer";
import { UpstreamError } from "./http";
import { resolveMusic } from "./resolve";

const platforms = new Map([
  ["spotify", { host: "open.spotify.com", name: "Spotify" }],
  ["applemusic", { host: "music.apple.com", name: "Apple Music" }],
  ["tidal", { host: "tidal.com", name: "TIDAL" }],
  ["amazonmusic", { host: "music.amazon.com", name: "Amazon Music" }],
]);

const app = new Hono<{ Bindings: CloudflareBindings }>()
  .use("/v1/*", cors({ origin: "*", allowMethods: ["GET", "OPTIONS"] }))
  .get("/preview/:isrc", async (c) => {
    const preview = await deezerPreview(c.req.param("isrc"));
    if (!preview) return c.notFound();
    const headers = new Headers({ "Accept-Encoding": "identity" });
    const response = await fetch(preview, { headers, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new UpstreamError("Deezer preview request failed", response.status);
    if (!response.headers.get("Content-Type")?.startsWith("audio/")) {
      await response.body?.cancel();
      throw new UpstreamError("Deezer returned unexpected preview content");
    }
    const length = Number(response.headers.get("Content-Length"));
    if (!Number.isSafeInteger(length) || length <= 0 || length > 2_000_000) {
      await response.body?.cancel();
      throw new UpstreamError("Deezer returned an invalid preview size");
    }
    const audio = new Uint8Array(await response.arrayBuffer());
    // Discord rejects Deezer's empty ID3v2.4 tag; leave other tags and audio frames intact.
    const emptyTag = [0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0].every(
      (byte, index) => audio[index] === byte,
    );
    const body = emptyTag ? audio.subarray(10) : audio;
    const output = new Headers({
      "Content-Type": response.headers.get("Content-Type")!,
      "Content-Length": String(body.byteLength),
      "Accept-Ranges": "bytes",
      "Cache-Control": response.headers.get("Cache-Control") ?? "no-store",
    });
    const range = c.req.header("Range")?.match(/^bytes=(\d*)-(\d*)$/);
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, body.byteLength - Number(range[2]));
      const end =
        range[1] && range[2]
          ? Math.min(Number(range[2]), body.byteLength - 1)
          : body.byteLength - 1;
      if (start >= body.byteLength || end < start) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${body.byteLength}` },
        });
      }
      output.set("Content-Range", `bytes ${start}-${end}/${body.byteLength}`);
      output.set("Content-Length", String(end - start + 1));
      return new Response(body.subarray(start, end + 1), { status: 206, headers: output });
    }
    return new Response(body, { headers: output });
  })
  .on("GET", ["/v1/links", "/:platform/*"], async (c) => {
    const share = c.req.path !== "/v1/links";
    const platform = platforms.get(c.req.param("platform")?.toLowerCase() ?? "");
    if (share && !platform) return c.notFound();
    const url = share
      ? `https://${platform!.host}/${c.req.path.split("/").slice(2).join("/")}${new URL(c.req.url).search}`
      : c.req.query("url");
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
    if (!share) return c.json(data);
    const item = data.item;
    let audio: string | undefined;
    try {
      let isrc = item.isrc;
      if (!isrc && item.type === "album" && item.tracks?.[0]) {
        const track = parseMusicURL(item.tracks[0].url);
        if (track) {
          const cachedTrack = force
            ? null
            : await c.env.CACHE.get<MusicLinks>(
                `v1:${track.provider}:${track.type}:${track.id}`,
                "json",
              );
          isrc = (cachedTrack ?? (await resolveMusic(track, c.env, force))).item.isrc;
        }
      }
      if (isrc && (await deezerPreview(isrc)))
        audio = new URL(`/preview/${encodeURIComponent(isrc)}?v=2`, c.req.url).href;
    } catch (error) {
      console.warn(
        formatLog("warn", EmbedlyErrors.PlatformFetchFailed, {
          source: "music",
          platform: "deezer",
          post_id: ref.id,
          ...getErrorContext(error),
        }),
      );
    }
    const description = [
      item.artists.join(", "),
      item.albumTitle,
      item.type === "track" ? "Song" : "Album",
      item.releaseDate?.slice(0, 4),
    ]
      .filter(Boolean)
      .join(" · ");
    return c.html(html`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${item.title}</title>
          <meta property="og:site_name" content="${platform!.name}" />
          <meta property="og:title" content="${item.title}" />
          <meta property="og:description" content="${description}" />
          <meta
            property="og:type"
            content="${item.type === "track" ? "music.song" : "music.album"}"
          />
          <meta property="og:url" content="${c.req.url}" />
          ${item.artwork ? html`<meta property="og:image" content="${item.artwork}" />` : ""}
          ${audio
            ? html`<meta property="og:audio" content="${audio}" /><meta
                  property="og:audio:type"
                  content="audio/mpeg"
                />`
            : ""}
        </head>
        <body></body>
      </html>`);
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
