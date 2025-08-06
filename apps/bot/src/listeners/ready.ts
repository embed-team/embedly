import { Events, Listener } from "@sapphire/framework";
import type { Client } from "discord.js";

export class ReadyListener extends Listener<typeof Events.ClientReady> {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options
  ) {
    super(context, {
      ...options,
      event: Events.ClientReady,
      once: true
    });
  }

  public run(client: Client) {
    const { username, id } = client.user!;
    this.container.logger.info(
      `Successfully logged in as ${username} (${id})`
    );
  }
}
