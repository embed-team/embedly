import { Events, Listener } from "@sapphire/framework";
import type { Client } from "discord.js";

import { syncEmojis } from "../lib/emojis";
import { observeDiscordInstallCounts } from "../lib/observability";

const INSTALL_COUNT_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

export class ReadyListener extends Listener<typeof Events.ClientReady> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.ClientReady,
      once: true,
    });
  }

  public async run(client: Client) {
    const { username, id } = client.user!;
    this.container.logger.info(`Successfully logged in as ${username} (${id})`);

    const application = client.application!;
    observeDiscordInstallCounts(application);
    const refreshInstallCounts = async () => {
      try {
        await application.fetch();
      } catch (error) {
        this.container.logger.error("Failed to refresh Discord install counts.", error);
      }
    };
    setInterval(() => void refreshInstallCounts(), INSTALL_COUNT_REFRESH_INTERVAL_MS).unref();
    await refreshInstallCounts();

    await syncEmojis();
  }
}
