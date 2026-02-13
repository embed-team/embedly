import { treaty } from "@elysiajs/eden";
import type { App } from "@embedly/api";
import {
  Embed,
  EmbedFlagNames,
  type EmbedFlags
} from "@embedly/builder";
import {
  EMBEDLY_EMBED_CREATED_MESSAGE,
  type EmbedlyInteractionContext,
  type EmbedlyPostContext,
  formatLog
} from "@embedly/logging";
import Platforms, {
  GENERIC_LINK_REGEX,
  getPlatformFromURL,
  hasLink,
  isEscaped,
  isSpoiler
} from "@embedly/platforms";
import {
  context,
  propagation,
  SpanStatusCode
} from "@opentelemetry/api";
import { Events, Listener } from "@sapphire/framework";
import { type Message, MessageFlags } from "discord.js";

const app = treaty<App>(process.env.EMBEDLY_API_DOMAIN!);

export class MessageListener extends Listener<
  typeof Events.MessageCreate
> {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options
  ) {
    super(context, {
      ...options,
      event: Events.MessageCreate
    });
  }

  public async run(message: Message) {
    this.container.client.id ??= this.container.client.user?.id ?? null;

    if (message.author.bot) return;
    if (message.author.id === this.container.client.id) return;
    if (!hasLink(message.content)) return;
    const urls = message.content.match(
      new RegExp(GENERIC_LINK_REGEX, "g")
    );
    if (!urls) return;

    this.container.tracer.startActiveSpan(
      "message",
      async (root_span) => {
        root_span.setAttributes({
          "discord.message_id": message.id,
          "discord.guild_id": message.guildId ?? "dm",
          "discord.channel_id": message.channelId,
          "discord.user_id": message.author.id
        });

        try {
          for (const [ind, url] of urls.entries()) {
            if (isEscaped(url, message.content)) continue;
            const platform =
              await this.container.tracer.startActiveSpan(
                "detect_platform",
                async (s) => {
                  const platform = getPlatformFromURL(url);
                  s.setAttribute(
                    "embedly.platform",
                    platform?.type ?? "unknown"
                  );
                  s.setAttribute("embedly.url", url);
                  s.end();
                  return platform;
                }
              );
            if (!platform) continue;

            const { data, error } =
              await this.container.tracer.startActiveSpan(
                "fetch_from_api",
                async (s) => {
                  s.setAttribute("embedly.platform", platform.type);
                  s.setAttribute("embedly.url", url);

                  const otelHeaders: Record<string, string> = {};
                  propagation.inject(context.active(), otelHeaders);

                  const res = await app.api.scrape.post(
                    {
                      platform: platform.type,
                      url
                    },
                    {
                      headers: {
                        authorization: `Bearer ${process.env.DISCORD_BOT_TOKEN}`,
                        ...otelHeaders
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
                    s.recordException(
                      "detail" in res.error.value
                        ? res.error.value.detail
                        : res.error.value.type
                    );
                  }
                  s.end();
                  return res;
                }
              );

            if (error) {
              if ("detail" in error.value) {
                const error_context: EmbedlyInteractionContext &
                  EmbedlyPostContext = {
                  ...("context" in error.value
                    ? error.value.context
                    : {}),
                  message_id: message.id,
                  user_id: message.author.id
                };
                this.container.logger.error(
                  formatLog(error.value, error_context)
                );
              }
              return;
            }

            const embed = await this.container.tracer.startActiveSpan(
              "create_embed",
              async (s) => {
                s.setAttribute("embedly.platform", platform.type);
                const embed =
                  await Platforms[platform.type].createEmbed(data);
                s.end();
                return embed;
              }
            );

            let link_style:
              | EmbedFlags[EmbedFlagNames.LinkStyle]
              | undefined;
            try {
              link_style = (await this.container.posthog.getFeatureFlag(
                "embed-link-styling-test",
                message.author.id
              )) as EmbedFlags[EmbedFlagNames.LinkStyle] | undefined;
            } catch {
              link_style = undefined;
            }

            const msg = {
              components: [
                Embed.getDiscordEmbed(embed, {
                  [EmbedFlagNames.Spoiler]: isSpoiler(
                    url,
                    message.content
                  ),
                  [EmbedFlagNames.LinkStyle]: link_style ?? "control"
                })!
              ],
              flags: MessageFlags.IsComponentsV2,
              allowedMentions: {
                parse: [],
                repliedUser: false
              }
            } as const;
            const bot_message =
              await this.container.tracer.startActiveSpan(
                "send_message",
                async (s) => {
                  const res =
                    ind > 0 && message.channel.isSendable()
                      ? await message.channel.send(msg)
                      : await message.reply(msg);
                  s.setAttribute("discord.bot_message_id", res.id);
                  s.end();
                  return res;
                }
              );
            this.container.embed_authors.set(
              bot_message.id,
              message.author.id
            );
            const existing =
              this.container.embed_messages.get(message.id) ?? [];
            existing.push(bot_message.id);
            this.container.embed_messages.set(message.id, existing);
            this.container.logger.info(
              formatLog(EMBEDLY_EMBED_CREATED_MESSAGE, {
                user_message_id: message.id,
                bot_message_id: bot_message.id,
                user_id: message.author.id,
                platform: platform.type,
                url
              })
            );
          }
          await message.edit({ flags: MessageFlags.SuppressEmbeds });
          root_span.setStatus({ code: SpanStatusCode.OK });
        } catch (error: any) {
          root_span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message
          });
          root_span.recordException(error);
        } finally {
          root_span.end();
        }
      }
    );
  }
}
