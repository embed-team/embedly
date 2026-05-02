import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { container } from "@sapphire/framework";
import { formatEmoji } from "discord.js";

export async function syncEmojis() {
  if (!container.client.application) return;

  container.logger.debug("Emojis: Starting Sync");

  const existingEmojiData = await container.client.application.emojis.fetch();
  const existingEmojis = existingEmojiData
    ? Object.fromEntries(existingEmojiData.map((emoji) => [emoji.name, emoji.id]))
    : {};

  const emojiDirectory = resolve(import.meta.dirname, "../emojis");
  const emojiFileNames = new Set((await readdir(emojiDirectory)).map((file) => file.split(".")[0]));

  const needToUpload = emojiFileNames.difference(new Set(Object.keys(existingEmojis)));
  container.logger.debug(`Emojis: Syncing ${needToUpload.size} emojis.`);
  const emojis = { ...existingEmojis };

  for (const emoji of needToUpload) {
    container.logger.debug(`Emojis: Uploading ${emoji} emoji.`);
    const emojiFile = await readFile(resolve(emojiDirectory, `${emoji}.png`));
    try {
      const uploaded = await container.client.application.emojis.create({
        name: emoji,
        attachment: `data:image/png;base64,${btoa(String.fromCharCode(...emojiFile))}`,
      });
      emojis[uploaded.name] = uploaded.id;
      container.logger.debug(`Emojis: Uploaded ${emoji} emoji.`);
    } catch (error) {
      const err = new Error(`Emojis: Failed to upload ${emoji} emoji!`, { cause: error });
      container.logger.error(err);
      throw err;
    }
  }

  container.emojis = emojis;
  container.logger.info(`Emojis: Synced ${Object.keys(emojis).length} Emojis`);
}

export function getEmojiByName(name: string) {
  const emoji = container.emojis[name];
  return formatEmoji({
    id: emoji,
    name,
  });
}

declare module "@sapphire/framework" {
  interface Container {
    emojis: Record<string, string>;
  }
}
