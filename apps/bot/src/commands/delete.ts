import {
  createProblem,
  EmbedlyErrors,
  EmbedlyLogs,
  formatDiscordError,
  getErrorContext,
} from "@embedly/logging";
import { Command } from "@sapphire/framework";
import {
  ApplicationCommandType,
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";

import {
  botErrors,
  botRequestDuration,
  getActiveTraceContext,
  log,
  markError,
  recordError,
  span,
} from "../lib/observability";

const DELETE_SUCCESS_MESSAGES = [
  "embed successfully yeeted into the void! ✨",
  "👋 bye bye embed! deletion complete!",
  "your embed has left the building! ✨",
  "poof~ your embed has vanished! ✨",
  "🧹 all tidy! embed removed as requested~",
];

export class DeleteCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      description: "Delete Embedly's response",
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerContextMenuCommand((command) =>
      command
        .setName("Delete Embed")
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

  public override async contextMenuRun(interaction: Command.ContextMenuCommandInteraction) {
    if (!interaction.isMessageContextMenuCommand()) return;

    const startedAt = Date.now();
    const requestId = `context_menu:${interaction.id}`;
    const logContext: Record<string, unknown> = {
      request_id: requestId,
      source: "context_menu",
      interaction_id: interaction.id,
      channel_id: interaction.channelId,
      guild_id: interaction.guildId ?? "dm",
      user_id: interaction.user.id,
      outcome: "success",
      status_code: 200,
    };
    const metricContext = { source: "context_menu", command: "delete" };

    await span(
      "delete.request",
      {
        "embedly.request_id": requestId,
        "embedly.source": "context_menu",
        "discord.interaction_id": interaction.id,
        "discord.guild_id": interaction.guildId ?? "dm",
        "discord.channel_id": interaction.channelId ?? "unknown",
        "discord.user_id": interaction.user.id,
      },
      async (requestSpan) => {
        try {
          const msg = interaction.targetMessage;
          logContext.message_id = msg.id;
          if (msg.author.id !== this.container.client.user?.id) {
            const problem = createProblem(EmbedlyErrors.DeleteFailed, {
              request_id: requestId,
              context: {
                ...logContext,
                reason: "not_bot_message",
              },
            });
            markError(requestSpan, problem.type, { "embedly.error_type": problem.type });
            Object.assign(logContext, {
              outcome: "error",
              status_code: problem.status,
              error_type: problem.type,
              reason: "not_bot_message",
            });
            botErrors.add(1, { ...metricContext, error_type: problem.type });
            await interaction.reply({
              content: formatDiscordError(problem),
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          await interaction.deferReply({
            flags: MessageFlags.Ephemeral,
          });

          if (!msg.deletable) {
            const problem = createProblem(EmbedlyErrors.DeleteFailed, {
              request_id: requestId,
              context: {
                ...logContext,
                reason: "not_deletable",
              },
            });
            markError(requestSpan, problem.type, { "embedly.error_type": problem.type });
            Object.assign(logContext, {
              outcome: "error",
              status_code: problem.status,
              error_type: problem.type,
              reason: "not_deletable",
            });
            botErrors.add(1, { ...metricContext, error_type: problem.type });
            await interaction.editReply(formatDiscordError(problem));
            return;
          }

          let originalAuthorId = await this.container.messageCache.getOriginalAuthorId(msg.id);

          if (!originalAuthorId) {
            try {
              const reference = await msg.fetchReference();
              originalAuthorId = reference.author.id;
            } catch (error) {
              const problem = createProblem(EmbedlyErrors.DeleteFailed, {
                request_id: requestId,
                context: {
                  ...logContext,
                  reason: "missing_original_author",
                  ...getErrorContext(error),
                },
              });
              recordError(requestSpan, error);
              Object.assign(logContext, getErrorContext(error), {
                outcome: "error",
                status_code: problem.status,
                error_type: problem.type,
                reason: "missing_original_author",
              });
              botErrors.add(1, { ...metricContext, error_type: problem.type });
              await interaction.editReply(formatDiscordError(problem));
              return;
            }
          }

          logContext.original_author_id = originalAuthorId;
          const isOriginalPoster = interaction.user.id === originalAuthorId;
          let hasManagePermission = false;

          if (interaction.inGuild()) {
            const guild = await interaction.guild!.fetch();
            const runner = await guild.members.fetch(interaction.member.user.id);
            hasManagePermission = runner.permissions.has(PermissionFlagsBits.ManageMessages, true);
          }

          logContext.has_manage_permission = hasManagePermission;
          if (!hasManagePermission && !isOriginalPoster) {
            const problem = createProblem(EmbedlyErrors.DeleteFailed, {
              request_id: requestId,
              context: {
                ...logContext,
                reason: "insufficient_permissions",
              },
            });
            markError(requestSpan, problem.type, { "embedly.error_type": problem.type });
            Object.assign(logContext, {
              outcome: "error",
              status_code: problem.status,
              error_type: problem.type,
              reason: "insufficient_permissions",
            });
            botErrors.add(1, { ...metricContext, error_type: problem.type });
            await interaction.editReply(formatDiscordError(problem));
            return;
          }

          try {
            await msg.delete();
            await this.container.messageCache.removeBotMessage(msg.id);
          } catch (error) {
            const problem = createProblem(EmbedlyErrors.DeleteFailed, {
              request_id: requestId,
              context: {
                ...logContext,
                ...getErrorContext(error),
              },
            });
            recordError(requestSpan, error);
            Object.assign(logContext, getErrorContext(error), {
              outcome: "error",
              status_code: problem.status,
              error_type: problem.type,
            });
            botErrors.add(1, { ...metricContext, error_type: problem.type });
            await interaction.editReply(formatDiscordError(problem));
            return;
          }

          await interaction.editReply(
            DELETE_SUCCESS_MESSAGES[~~(DELETE_SUCCESS_MESSAGES.length * Math.random())],
          );
        } finally {
          Object.assign(logContext, getActiveTraceContext(), {
            duration_ms: Date.now() - startedAt,
          });
          botRequestDuration.record(Number(logContext.duration_ms), metricContext);
          const level = logContext.outcome === "success" ? "info" : "error";
          log(level, EmbedlyLogs.DeleteRequest, logContext);
        }
      },
    );
  }
}
