import { treaty } from "@elysiajs/eden";
import type { App } from "@embedly/api";
import Platforms, {
  type EmbedlyPlatformType
} from "@embedly/platforms";
import { SpanStatusCode } from "@opentelemetry/api";
import { container } from "@sapphire/framework";

const app = treaty<App>(process.env.EMBEDLY_API_DOMAIN!);

export async function fetchPostData(
  platform_type: EmbedlyPlatformType,
  url: string,
  otel_headers: Record<string, string>
): Promise<Record<string, any>> {
  const handler = Platforms[platform_type];

  const { data, error } = await container.tracer.startActiveSpan(
    "fetch_from_api",
    async (s) => {
      s.setAttribute("embedly.platform", platform_type);
      s.setAttribute("embedly.url", url);

      const res = await app.api.scrape.post(
        { platform: platform_type, url },
        {
          headers: {
            authorization: `Bearer ${process.env.DISCORD_BOT_TOKEN}`,
            ...otel_headers
          }
        }
      );

      if (res.error) {
        s.setStatus({
          code: SpanStatusCode.ERROR,
          message:
            "detail" in res.error.value
              ? res.error.value.detail
              : res.error.value.type
        });
      }
      s.end();
      return res;
    }
  );

  if (!error) {
    return data;
  }

  return await container.tracer.startActiveSpan(
    "fetch_direct_fallback",
    async (s) => {
      s.setAttribute("embedly.platform", platform_type);
      s.setAttribute("embedly.url", url);
      s.setAttribute("embedly.api_error_status", error.status);

      try {
        const post_id = await handler.parsePostId(url);
        s.setAttribute("embedly.post_id", post_id);
        const post_data = await handler.fetchPost(post_id, {
          EMBED_USER_AGENT: process.env.EMBED_USER_AGENT ?? ""
        });
        s.setStatus({ code: SpanStatusCode.OK });
        return post_data as Record<string, any>;
      } catch (fallback_error: any) {
        s.setStatus({
          code: SpanStatusCode.ERROR,
          message: fallback_error.message ?? String(fallback_error)
        });
        s.recordException(fallback_error);
        throw fallback_error;
      } finally {
        s.end();
      }
    }
  );
}
