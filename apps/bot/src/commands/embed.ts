import {
  createProblem,
  EmbedlyErrors,
  EmbedlyLogs,
  formatDiscordError,
  formatLog,
  formatProblemLog,
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
import { extractURLs } from "../lib/utils";

type EmbedSource = "message" | "command" | "context_menu";
type ScrapeResponse = Awaited<ReturnType<(typeof Platforms)[keyof typeof Platforms]["transform"]>>;

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
    content: string,
    flags: Partial<EmbedFlags>,
    force: boolean = false,
    interactionOrMessage:
      | Command.ChatInputCommandInteraction
      | Command.ContextMenuCommandInteraction
      | Message,
    source?: EmbedSource,
  ) {
    const isMessage = interactionOrMessage instanceof Message;
    const embedSource = source ?? (isMessage ? "message" : "command");
    let sentEmbed = false;
    const urls = extractURLs(content);
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
        urls.map(async (url) => {
          const match = await matchURL(url);
          return match ? { url, ...match } : null;
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

    for (const [i, { platform, id }] of matches.entries()) {
      const requestId = isMessage
        ? `message:${interactionOrMessage.id}`
        : `${embedSource}:${interactionOrMessage.id}`;
      const logContext = {
        request_id: requestId,
        source: embedSource,
        platform,
        post_id: id,
        ...(isMessage
          ? {
              message_id: interactionOrMessage.id,
              user_id: interactionOrMessage.author.id,
            }
          : {
              interaction_id: interactionOrMessage.id,
              user_id: interactionOrMessage.user.id,
            }),
      };

      let post: ScrapeResponse;
      try {
        const req = await container.api.platforms.scrape.$post(
          { json: { platform, id, force } },
          {
            headers: {
              Authorization: `Bearer ${process.env.EMBEDLY_AUTH_SECRET}`,
              "X-Embedly-Request-Id": requestId,
              "X-Embedly-Source": embedSource,
            },
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
          container.logger.error(formatProblemLog("error", problem));
          if (isMessage) continue;
          await interactionOrMessage.editReply({
            content: formatDiscordError(problem),
          });
          continue;
        }

        post = body as ScrapeResponse;
      } catch (error) {
        const problem = createProblem(EmbedlyErrors.ApiUnexpectedResponse, {
          request_id: requestId,
          context: { ...logContext, ...getErrorContext(error) },
        });
        container.logger.error(
          formatLog("error", EmbedlyErrors.ApiUnexpectedResponse, problem.context),
        );
        if (isMessage) continue;
        await interactionOrMessage.editReply({
          content: formatDiscordError(problem),
        });
        continue;
      }

      const component = buildEmbed(post, flags);
      if (!component) {
        const problem = createProblem(EmbedlyErrors.NoMediaFound, {
          request_id: requestId,
          context: logContext,
        });
        container.logger.warn(formatLog("warn", EmbedlyErrors.NoMediaFound, problem.context));
        if (isMessage) continue;
        const response = { content: formatDiscordError(problem) };
        if (i === 0) {
          await interactionOrMessage.editReply(response);
        } else {
          await interactionOrMessage.followUp(response);
        }
        continue;
      }
      const response = {
        components: [component],
        flags: [MessageFlags.IsComponentsV2],
        allowedMentions: {
          parse: [],
          repliedUser: false,
        },
      } as const;
      if (isMessage) {
        try {
          const botMessage =
            i > 0 && interactionOrMessage.channel.isSendable()
              ? await interactionOrMessage.channel.send(response)
              : await interactionOrMessage.reply(response);
          await container.messageCache.save(
            interactionOrMessage.id,
            botMessage.id,
            interactionOrMessage.author.id,
          );
          container.logger.info(
            formatLog("info", EmbedlyLogs.EmbedCreated, {
              ...logContext,
              bot_message_id: botMessage.id,
            }),
          );
          sentEmbed = true;
        } catch (error) {
          container.logger.error(
            formatLog("error", EmbedlyErrors.DiscordSendFailed, {
              ...logContext,
              ...getErrorContext(error),
            }),
          );
        }
        continue;
      }
      if (i === 0) {
        try {
          const botMessage = await interactionOrMessage.editReply(response);
          container.logger.info(
            formatLog("info", EmbedlyLogs.EmbedCreated, {
              ...logContext,
              bot_message_id: botMessage.id,
            }),
          );
          sentEmbed = true;
        } catch (error) {
          const problem = createProblem(EmbedlyErrors.DiscordSendFailed, {
            request_id: requestId,
            context: { ...logContext, ...getErrorContext(error) },
          });
          container.logger.error(
            formatLog("error", EmbedlyErrors.DiscordSendFailed, problem.context),
          );
        }
        continue;
      }
      try {
        const botMessage = await interactionOrMessage.followUp(response);
        container.logger.info(
          formatLog("info", EmbedlyLogs.EmbedCreated, {
            ...logContext,
            bot_message_id: botMessage.id,
          }),
        );
        sentEmbed = true;
      } catch (error) {
        const problem = createProblem(EmbedlyErrors.DiscordSendFailed, {
          request_id: requestId,
          context: { ...logContext, ...getErrorContext(error) },
        });
        container.logger.error(
          formatLog("error", EmbedlyErrors.DiscordSendFailed, problem.context),
        );
      }
    }
    return sentEmbed;
  }

  public override async contextMenuRun(interaction: Command.ContextMenuCommandInteraction) {
    if (!interaction.isMessageContextMenuCommand()) return;
    const msg = interaction.targetMessage;
    await EmbedCommand.handleUrls(msg.content, {}, false, interaction, "context_menu");
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const url = interaction.options.getString("url", true);
    await EmbedCommand.handleUrls(
      url,
      {
        MediaOnly: interaction.options.getBoolean("media_only") ?? false,
        SourceOnly: interaction.options.getBoolean("source_only") ?? false,
        Spoiler: interaction.options.getBoolean("spoiler") ?? false,
      },
      interaction.options.getBoolean("force") ?? false,
      interaction,
      "command",
    );
  }
}
