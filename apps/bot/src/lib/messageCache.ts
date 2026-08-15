import { EmbedlyErrors, formatLog, getErrorContext } from "@embedly/logging";
import { createClient } from "redis";

const MESSAGE_CACHE_TTL_SECONDS = Number(process.env.MESSAGE_CACHE_TTL_SECONDS ?? 60 * 60 * 24);
const CACHE_URL = process.env.CACHE_URL ?? "redis://localhost:6379";

interface SourceMessageCache {
  botMessageIds: string[];
}

export class MessageCache {
  private constructor(private readonly client: ReturnType<typeof createClient>) {}

  public static async connect() {
    const client = createClient({ url: CACHE_URL });
    client.on("error", (error) => {
      console.error(
        formatLog("error", EmbedlyErrors.MessageCacheFailed, {
          ...getErrorContext(error),
        }),
      );
    });
    await client.connect();
    return new MessageCache(client);
  }

  public async save(sourceMessageId: string, botMessageId: string, authorId: string) {
    const messageKey = this.getSourceMessageKey(sourceMessageId);
    const authorKey = this.getBotMessageAuthorKey(botMessageId);
    const sourceKey = this.getBotMessageSourceKey(botMessageId);
    const existing = await this.getSourceMessage(sourceMessageId);
    const botMessageIds = existing?.botMessageIds ?? [];

    if (!botMessageIds.includes(botMessageId)) {
      botMessageIds.push(botMessageId);
    }

    await this.client
      .multi()
      .set(messageKey, JSON.stringify({ botMessageIds }), { EX: MESSAGE_CACHE_TTL_SECONDS })
      .set(authorKey, authorId, { EX: MESSAGE_CACHE_TTL_SECONDS })
      .set(sourceKey, sourceMessageId, { EX: MESSAGE_CACHE_TTL_SECONDS })
      .exec();
  }

  public async getOriginalAuthorId(botMessageId: string) {
    return await this.client.get(this.getBotMessageAuthorKey(botMessageId));
  }

  public async removeBotMessage(botMessageId: string) {
    const sourceMessageId = await this.client.get(this.getBotMessageSourceKey(botMessageId));
    const keys = [
      this.getBotMessageAuthorKey(botMessageId),
      this.getBotMessageSourceKey(botMessageId),
    ];

    if (!sourceMessageId) {
      await this.client.del(keys);
      return;
    }

    const sourceMessage = await this.getSourceMessage(sourceMessageId);
    const botMessageIds = sourceMessage?.botMessageIds.filter((id) => id !== botMessageId) ?? [];
    const transaction = this.client.multi().del(keys);

    if (botMessageIds.length === 0) {
      transaction.del(this.getSourceMessageKey(sourceMessageId));
    } else {
      transaction.set(
        this.getSourceMessageKey(sourceMessageId),
        JSON.stringify({ botMessageIds }),
        {
          EX: MESSAGE_CACHE_TTL_SECONDS,
        },
      );
    }

    await transaction.exec();
  }

  public async getBotMessageIds(sourceMessageId: string) {
    const sourceMessage = await this.getSourceMessage(sourceMessageId);
    return sourceMessage?.botMessageIds ?? [];
  }

  public async close() {
    await this.client.close();
  }

  private async getSourceMessage(sourceMessageId: string): Promise<SourceMessageCache | null> {
    const raw = await this.client.get(this.getSourceMessageKey(sourceMessageId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    /* oxlint-disable anti-slop/no-runtime-typeof -- External cache data needs runtime validation. */
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("botMessageIds" in parsed) ||
      !Array.isArray(parsed.botMessageIds) ||
      !parsed.botMessageIds.every((id) => typeof id === "string")
    ) {
      throw new Error("Invalid source message cache entry");
    }
    /* oxlint-enable anti-slop/no-runtime-typeof */
    return { botMessageIds: parsed.botMessageIds };
  }

  private getSourceMessageKey(messageId: string) {
    return `embedly:message:${messageId}`;
  }

  private getBotMessageAuthorKey(messageId: string) {
    return `embedly:bot-author:${messageId}`;
  }

  private getBotMessageSourceKey(messageId: string) {
    return `embedly:bot-source:${messageId}`;
  }
}
