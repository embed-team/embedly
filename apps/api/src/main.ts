import { Embed } from "@embedly/builder";
import {
  EMBEDLY_CACHED_POST,
  EMBEDLY_CACHING_POST,
  EMBEDLY_NO_LINK_IN_MESSAGE,
  EMBEDLY_NO_VALID_LINK,
  type EmbedlyPostContext,
  formatBetterStack,
  formatDiscord
} from "@embedly/logging";
import {
  GENERIC_LINK_REGEX,
  getPlatformFromURL,
  hasLink
} from "@embedly/parser";
import Platforms from "@embedly/platforms";
import { EmbedlyPlatformType } from "@embedly/types";
import { Logtail } from "@logtail/edge";
import {
  type APIInteractionResponseChannelMessageWithSource,
  InteractionResponseType,
  MessageFlags
} from "discord-api-types/v10";
import { Elysia, t } from "elysia";

const app = (env: Env, ctx: ExecutionContext) =>
  new Elysia({ aot: false })
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
    )
    .post(
      "/api/embed",
      async ({ body, headers, logger, set, status }) => {
        const message = body as Record<string, any>;
        const log_ctx: Record<string, any> = {
          user_id: message.author?.id
        };
        log_ctx.message_id = message.id;

        if (!hasLink(message.content)) {
          const err = EMBEDLY_NO_LINK_IN_MESSAGE;
          logger.warn(...formatBetterStack(err, log_ctx));
          return status(err.status!, {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content: formatDiscord(err, log_ctx),
              flags: MessageFlags.Ephemeral
            }
          } satisfies APIInteractionResponseChannelMessageWithSource);
        }
        const url = GENERIC_LINK_REGEX.exec(message.content)?.[0]!;

        const platform = getPlatformFromURL(url);
        if (!platform) {
          const err = EMBEDLY_NO_VALID_LINK;
          logger.warn(...formatBetterStack(err, log_ctx));
          return status(err.status!, {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content: formatDiscord(err, log_ctx),
              flags: MessageFlags.Ephemeral
            }
          } satisfies APIInteractionResponseChannelMessageWithSource);
        }
        const handler = Object.values(Platforms).find(
          (p) => p.name === platform.type
        );
        if (!handler) {
          throw new Error();
        }
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

            logger.error(
              ...formatBetterStack(
                handler.log_messages.failed,
                post_log_ctx
              )
            );
          }

          // handler.addPostToCache(post_id, post_data, env.STORAGE);
          logger.debug(
            ...formatBetterStack(EMBEDLY_CACHING_POST, post_log_ctx)
          );
        } else {
          logger.debug(
            ...formatBetterStack(EMBEDLY_CACHED_POST, post_log_ctx)
          );
        }

        if (handler.name === EmbedlyPlatformType.Instagram) {
          post_data!.url = url;
        }

        const embed = handler.createEmbed(post_data);
        set.headers["content-type"] = "application/json";
        return headers.accept === "application/vnd.embedly.container"
          ? [Embed.getDiscordEmbed(embed)]
          : embed;
      },
      { auth: true }
    );

export default {
  fetch(req, env, ctx) {
    return app(env, ctx).fetch(req);
  }
} satisfies ExportedHandler<Env>;

export type App = ReturnType<typeof app>;
