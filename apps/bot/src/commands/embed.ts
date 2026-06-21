import {
  createProblem,
  EmbedlyErrors,
  EmbedlyLogs,
  formatDiscordError,
  formatLog,
  getErrorContext,
  isEmbedlyProblem,
} from "@embedly/logging";
import { matchURL, Platforms } from "@embedly/platforms";
import { Command, container } from "@sapphire/framework";
import {
  ApplicationCommandType,
  ApplicationIntegrationType,
  InteractionContextType,
  Message,
  MessageFlags,
} from "discord.js";

import { buildEmbed, EmbedFlags } from "../lib/builder";
import {
  botEmbedsCreated,
  botErrors,
  botInvocations,
  botRequestDuration,
  getActiveTraceContext,
  injectTraceHeaders,
  log,
  markError,
  recordError,
  span,
} from "../lib/observability";
import { extractURLs } from "../lib/utils";

type EmbedSource = "message" | "command" | "context_menu";
type ScrapeResponse = Awaited<ReturnType<(typeof Platforms)[keyof typeof Platforms]["transform"]>>;

export interface EmbedURLRequest {
  url: string;
  flags?: Partial<EmbedFlags>;
  force?: boolean;
}

export class EmbedCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      description: "Enrich the embeds of social media links",
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry
      .registerChatInputCommand((command) =>
        command
          .setName(this.name)
          .setDescription(this.description)
          .addStringOption((opt) =>
            opt.setName("url").setDescription("Link to content").setRequired(true),
          )
          .addBooleanOption((opt) =>
            opt.setName("media_only").setDescription("Display the media only"),
          )
          .addBooleanOption((opt) =>
            opt
              .setName("source_only")
              .setDescription("Show only the original post (no reply chains or quotes)"),
          )
          .addBooleanOption((opt) =>
            opt.setName("spoiler").setDescription("Hide embed content behind spoiler"),
          )
          .addBooleanOption((opt) =>
            opt.setName("force").setDescription("Force the bot to re-fetch the post."),
          )
          .setContexts(
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel,
          )
          .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall,
          ),
      )
      .registerContextMenuCommand((command) =>
        command
          .setName("Embed Links")
          .setType(ApplicationCommandType.Message)
          .setContexts(
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel,
          )
          .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall,
          ),
      );
  }

  static async handleUrls(
    urls: EmbedURLRequest[],
    interactionOrMessage:
      | Command.ChatInputCommandInteraction
      | Command.ContextMenuCommandInteraction
      | Message,
    source?: EmbedSource,
  ) {
    const isMessage = interactionOrMessage instanceof Message;
    const embedSource = source ?? (isMessage ? "message" : "command");
    let sentEmbed = false;
    if (urls.length === 0) {
      if (isMessage) return sentEmbed;
      const requestId = `${embedSource}:${interactionOrMessage.id}`;
      const problem = createProblem(EmbedlyErrors.NoUrlsFound, {
        request_id: requestId,
        context: {
          request_id: requestId,
          source: embedSource,
          interaction_id: interactionOrMessage.id,
          user_id: interactionOrMessage.user.id,
        },
      });
      container.logger.warn(formatLog("warn", EmbedlyErrors.NoUrlsFound, problem.context));
      await interactionOrMessage.reply({
        content: formatDiscordError(problem),
        flags: [MessageFlags.Ephemeral],
      });
      return sentEmbed;
    }

    if (!isMessage) await interactionOrMessage.deferReply();

    const matches = (
      await Promise.all(
        urls.map(async (request) => {
          const match = await matchURL(request.url);
          return match ? { ...request, ...match } : null;
        }),
      )
    ).filter((m) => m !== null);

    if (!isMessage && matches.length === 0) {
      const requestId = `${embedSource}:${interactionOrMessage.id}`;
      const problem = createProblem(EmbedlyErrors.NoMatchesFound, {
        request_id: requestId,
        context: {
          request_id: requestId,
          source: embedSource,
          interaction_id: interactionOrMessage.id,
          user_id: interactionOrMessage.user.id,
        },
      });
      container.logger.warn(formatLog("warn", EmbedlyErrors.NoMatchesFound, problem.context));
      await interactionOrMessage.editReply({
        content: formatDiscordError(problem),
      });
      return sentEmbed;
    }

    for (const [i, { platform, id, flags, force }] of matches.entries()) {
      const startedAt = Date.now();
      const requestId = isMessage
        ? `message:${interactionOrMessage.id}:${i}`
        : `${embedSource}:${interactionOrMessage.id}:${i}`;
      const logContext: Record<string, unknown> = {
        request_id: requestId,
        source: embedSource,
        platform,
        post_id: id,
        force: force ?? false,
        outcome: "success",
        status_code: 200,
        ...(isMessage
          ? {
              message_id: interactionOrMessage.id,
              channel_id: interactionOrMessage.channelId,
              guild_id: interactionOrMessage.guildId ?? "dm",
              user_id: interactionOrMessage.author.id,
            }
          : {
              interaction_id: interactionOrMessage.id,
              channel_id: interactionOrMessage.channelId,
              guild_id: interactionOrMessage.guildId ?? "dm",
              user_id: interactionOrMessage.user.id,
            }),
      };

      const spanAttributes = {
        "embedly.request_id": requestId,
        "embedly.source": embedSource,
        "embedly.platform": platform,
        "embedly.post_id": id,
      };
      const metricContext = { source: embedSource, platform };
      botInvocations.add(1, metricContext);

      await span(
        "embed.request",
        {
          ...spanAttributes,
          "discord.guild_id": String(logContext.guild_id),
          "discord.channel_id": String(logContext.channel_id),
          "discord.user_id": String(logContext.user_id),
        },
        async (requestSpan) => {
          try {
            let post: ScrapeResponse;
            try {
              const req = await span(
                "api.scrape",
                {
                  ...spanAttributes,
                },
                async (apiSpan) => {
                  const response = await container.api.platforms.scrape.$post(
                    { json: { platform, id, force: force ?? false } },
                    {
                      headers: injectTraceHeaders({
                        Authorization: `Bearer ${process.env.EMBEDLY_AUTH_SECRET}`,
                        "X-Embedly-Request-Id": requestId,
                        "X-Embedly-Source": embedSource,
                      }),
                    },
                  );
                  apiSpan.setAttribute("http.response.status_code", response.status);
                  if (!response.ok) {
                    markError(apiSpan, `API returned ${response.status}`, {
                      "http.response.status_code": response.status,
                    });
                  }
                  return response;
                },
              );
              const body = await req.json();

              if (!req.ok) {
                const problem = isEmbedlyProblem(body)
                  ? body
                  : createProblem(EmbedlyErrors.ApiUnexpectedResponse, {
                      request_id: requestId,
                      context: { ...logContext, response_status: req.status },
                    });
                markError(requestSpan, problem.type, {
                  "http.response.status_code": req.status,
                  "embedly.error_type": problem.type,
                });
                Object.assign(logContext, {
                  outcome: "error",
                  status_code: req.status,
                  error_type: problem.type,
                });
                botErrors.add(1, { ...metricContext, error_type: problem.type });
                if (isMessage) return;
                await interactionOrMessage.editReply({
                  content: formatDiscordError(problem),
                });
                return;
              }

              post = body as ScrapeResponse;
            } catch (error) {
              recordError(requestSpan, error);
              const problem = createProblem(EmbedlyErrors.ApiUnexpectedResponse, {
                request_id: requestId,
                context: { ...logContext, ...getErrorContext(error) },
              });
              Object.assign(logContext, getErrorContext(error), {
                outcome: "error",
                status_code: problem.status,
                error_type: problem.type,
              });
              botErrors.add(1, { ...metricContext, error_type: problem.type });
              if (isMessage) return;
              await interactionOrMessage.editReply({
                content: formatDiscordError(problem),
              });
              return;
            }

            const component = await span(
              "embed.build",
              {
                ...spanAttributes,
              },
              async () => buildEmbed(post, flags),
            );
            if (!component) {
              const problem = createProblem(EmbedlyErrors.NoMediaFound, {
                request_id: requestId,
                context: logContext,
              });
              Object.assign(logContext, {
                outcome: "skipped",
                status_code: problem.status,
                error_type: problem.type,
              });
              if (isMessage) return;
              const response = { content: formatDiscordError(problem) };
              if (i === 0) {
                await interactionOrMessage.editReply(response);
              } else {
                await interactionOrMessage.followUp(response);
              }
              return;
            }

            const response = {
              components: [component],
              flags: [MessageFlags.IsComponentsV2],
              allowedMentions: {
                parse: [],
                repliedUser: false,
              },
            } as const;

            try {
              const botMessage = await span(
                "discord.send",
                {
                  ...spanAttributes,
                  "discord.guild_id": String(logContext.guild_id),
                  "discord.channel_id": String(logContext.channel_id),
                },
                async (sendSpan) => {
                  const message = isMessage
                    ? i > 0 && interactionOrMessage.channel.isSendable()
                      ? await interactionOrMessage.channel.send(response)
                      : await interactionOrMessage.reply(response)
                    : i === 0
                      ? await interactionOrMessage.editReply(response)
                      : await interactionOrMessage.followUp(response);
                  sendSpan.setAttribute("discord.bot_message_id", message.id);
                  return message;
                },
              );
              logContext.bot_message_id = botMessage.id;
              if (isMessage) {
                await span(
                  "message_cache.save",
                  {
                    ...spanAttributes,
                    "discord.source_message_id": interactionOrMessage.id,
                    "discord.bot_message_id": botMessage.id,
                  },
                  async () => {
                    await container.messageCache.save(
                      interactionOrMessage.id,
                      botMessage.id,
                      interactionOrMessage.author.id,
                    );
                  },
                );
              }
              botEmbedsCreated.add(1, metricContext);
              sentEmbed = true;
            } catch (error) {
              recordError(requestSpan, error);
              const problem = createProblem(EmbedlyErrors.DiscordSendFailed, {
                request_id: requestId,
                context: { ...logContext, ...getErrorContext(error) },
              });
              Object.assign(logContext, getErrorContext(error), {
                outcome: "error",
                status_code: problem.status,
                error_type: problem.type,
              });
              botErrors.add(1, { ...metricContext, error_type: problem.type });
              if (isMessage) return;
              await interactionOrMessage.editReply(formatDiscordError(problem));
            }
          } finally {
            Object.assign(logContext, getActiveTraceContext(), {
              duration_ms: Date.now() - startedAt,
            });
            botRequestDuration.record(Number(logContext.duration_ms), metricContext);
            const level =
              logContext.outcome === "success"
                ? "info"
                : logContext.outcome === "skipped"
                  ? "warn"
                  : "error";
            log(level, EmbedlyLogs.EmbedRequest, logContext);
          }
        },
      );
    }
    return sentEmbed;
  }

  public override async contextMenuRun(interaction: Command.ContextMenuCommandInteraction) {
    if (!interaction.isMessageContextMenuCommand()) return;
    const msg = interaction.targetMessage;
    await EmbedCommand.handleUrls(
      extractURLs(msg.content).map(({ url }) => ({ url })),
      interaction,
      "context_menu",
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const url = interaction.options.getString("url", true);
    await EmbedCommand.handleUrls(
      extractURLs(url).map(({ url }) => ({
        url,
        flags: {
          MediaOnly: interaction.options.getBoolean("media_only") ?? false,
          SourceOnly: interaction.options.getBoolean("source_only") ?? false,
          Spoiler: interaction.options.getBoolean("spoiler") ?? false,
        },
        force: interaction.options.getBoolean("force") ?? false,
      })),
      interaction,
      "command",
    );
  }
}
