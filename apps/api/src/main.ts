import {
  EMBEDLY_CACHED_POST,
  EMBEDLY_CACHING_POST,
  EMBEDLY_NO_LINK_IN_MESSAGE,
  EMBEDLY_NO_VALID_LINK,
  type EmbedlyPostContext,
  formatBetterStack
} from "@embedly/logging";
import {
  GENERIC_LINK_REGEX,
  getPlatformFromURL,
  hasLink
} from "@embedly/parser";
import Platforms from "@embedly/platforms";
import { EmbedlyPlatformType } from "@embedly/types";
import { Logtail } from "@logtail/edge";
import { Elysia, t } from "elysia";

const app = (env: Env, ctx: ExecutionContext) =>
  new Elysia({ aot: false, normalize: false })
    .onError(({ error }) => {
      console.error(error);
    })
    .decorate({ env, ctx })
    .derive(({ ctx, env }) => {
      const logtail = new Logtail(env.BETTERSTACK_SOURCE_TOKEN, {
        endpoint: env.BETTERSTACK_INGESTING_HOST
      });
      return {
        logger: logtail.withExecutionContext(ctx)
      };
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
      async ({ body: { platform, url }, status, logger, set }) => {
        const handler = Platforms[platform as keyof typeof Platforms];
        const post_id = handler.parsePostId(url);
        const post_log_ctx: EmbedlyPostContext = {
          platform: handler.name,
          post_url: url,
          post_id
        };
        let post_data = await handler.getPostFromCache(
          post_id,
          env.STORAGE
        );
        if (!post_data) {
          logger.debug(
            ...formatBetterStack(
              handler.log_messages.fetching,
              post_log_ctx
            )
          );

          try {
            post_data = await handler.fetchPost(post_id, env);
          } catch (error: any) {
            post_log_ctx.resp_status = error.code;
            post_log_ctx.resp_message = error.message;

            const err = handler.log_messages.failed;
            err.context = post_log_ctx;

            logger.error(...formatBetterStack(err, err.context));

            return status(err.status!, err);
          }

          if (!post_data) {
            const err = handler.log_messages.failed;
            return status(err.status!, err);
          }

          if (handler.name === EmbedlyPlatformType.Instagram) {
            post_data!.url = url;
          }

          handler.addPostToCache(post_id, post_data, env.STORAGE);
          logger.debug(
            ...formatBetterStack(EMBEDLY_CACHING_POST, post_log_ctx)
          );
        } else {
          logger.debug(
            ...formatBetterStack(EMBEDLY_CACHED_POST, post_log_ctx)
          );
        }

        set.headers["content-type"] = "application/json";
        return post_data as Record<string, any>;
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
        const url = GENERIC_LINK_REGEX.exec(message.content)?.[0]!;
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
    );

export default {
  fetch(req, env, ctx) {
    return app(env, ctx).fetch(req);
  }
} satisfies ExportedHandler<Env>;

export type App = ReturnType<typeof app>;
