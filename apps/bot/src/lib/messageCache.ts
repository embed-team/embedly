import { createClient, type RedisClientType } from "redis";

const MESSAGE_CACHE_TTL_SECONDS = Number(process.env.MESSAGE_CACHE_TTL_SECONDS ?? 60 * 60 * 24);
const CACHE_URL = process.env.CACHE_URL ?? "redis://localhost:6379";

interface SourceMessageCache {
  botMessageIds: string[];
}

export class MessageCache {
  private constructor(private readonly client: RedisClientType) {}

  public static async connect() {
    const client = createClient({ url: CACHE_URL });
    client.on("error", (error) => {
      console.error("Message cache error", error);
    });
    await client.connect();
    return new MessageCache(client as RedisClientType);
  }

  public async save(sourceMessageId: string, botMessageId: string, authorId: string) {
    const messageKey = this.getSourceMessageKey(sourceMessageId);
    const authorKey = this.getBotMessageAuthorKey(botMessageId);
    const existing = await this.getSourceMessage(sourceMessageId);
    const botMessageIds = existing?.botMessageIds ?? [];

    if (!botMessageIds.includes(botMessageId)) {
      botMessageIds.push(botMessageId);
    }

    await this.client
      .multi()
      .set(messageKey, JSON.stringify({ botMessageIds }), { EX: MESSAGE_CACHE_TTL_SECONDS })
      .set(authorKey, authorId, { EX: MESSAGE_CACHE_TTL_SECONDS })
      .exec();
  }

  public async getBotMessageIds(sourceMessageId: string) {
    const sourceMessage = await this.getSourceMessage(sourceMessageId);
    return sourceMessage?.botMessageIds ?? [];
  }

  public async deleteSourceMessage(sourceMessageId: string) {
    const botMessageIds = await this.getBotMessageIds(sourceMessageId);
    const keys = [
      this.getSourceMessageKey(sourceMessageId),
      ...botMessageIds.map((id) => this.getBotMessageAuthorKey(id)),
    ];

    await this.client.del(keys);
    return botMessageIds;
  }

  public async close() {
    await this.client.close();
  }

  private async getSourceMessage(sourceMessageId: string): Promise<SourceMessageCache | null> {
    const raw = await this.client.get(this.getSourceMessageKey(sourceMessageId));
    if (!raw) return null;
    return JSON.parse(raw) as SourceMessageCache;
  }

  private getSourceMessageKey(messageId: string) {
    return `embedly:message:${messageId}`;
  }

  private getBotMessageAuthorKey(messageId: string) {
    return `embedly:bot-author:${messageId}`;
  }
}
