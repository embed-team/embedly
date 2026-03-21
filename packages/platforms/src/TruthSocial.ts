import { EmbedlyMastodon } from "./Mastodon.ts";
import { EmbedlyPlatformType } from "./types.ts";

export class TruthSocial extends EmbedlyMastodon {
  readonly color = [24, 50, 92] as const;
  readonly emoji = "<:truthsocial:0000000000000000000>";
  readonly base_url = "https://truthsocial.com";

  constructor() {
    super(
      EmbedlyPlatformType.TruthSocial,
      "truthsocial",
      "truthsocial.com"
    );
  }
}
