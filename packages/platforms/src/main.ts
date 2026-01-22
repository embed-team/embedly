import { CBC } from "./CBC.ts";
import { Instagram } from "./Instagram.ts";
import { registerPlatformDetector } from "./parsing.ts";
import { Reddit } from "./Reddit.ts";
import { Threads } from "./Threads.ts";
import { TikTok } from "./TikTok.ts";
import { Twitter } from "./Twitter.ts";
import { EmbedlyPlatformType } from "./types.ts";

export const Platforms = {
  [EmbedlyPlatformType.Twitter]: new Twitter(),
  [EmbedlyPlatformType.Instagram]: new Instagram(),
  [EmbedlyPlatformType.TikTok]: new TikTok(),
  [EmbedlyPlatformType.CBC]: new CBC(),
  [EmbedlyPlatformType.Threads]: new Threads(),
  [EmbedlyPlatformType.Reddit]: new Reddit()
} as const;

export const EmbedlyPlatformColors = Object.fromEntries(
  Object.entries(Platforms).map(([key, platform]) => [
    key,
    platform.color
  ])
) as Record<EmbedlyPlatformType, readonly [number, number, number]>;

export const platformEmojis = Object.fromEntries(
  Object.entries(Platforms).map(([key, platform]) => [
    key,
    platform.emoji
  ])
) as Record<EmbedlyPlatformType, string>;

registerPlatformDetector((url: string) => {
  for (const [name, platform] of Object.entries(Platforms)) {
    if (platform.matchesUrl(url)) {
      return { type: name as EmbedlyPlatformType };
    }
  }
  return null;
});

export { CF_CACHE_OPTIONS, GENERIC_LINK_REGEX } from "./constants.ts";
export { type CloudflareEnv, EmbedlyPlatform } from "./Platform.ts";
export {
  getPlatformFromURL,
  hasLink,
  isEscaped,
  isSpoiler
} from "./parsing.ts";
export {
  EmbedlyPlatformType,
  type Emojis,
  emojis,
  type StatEmojis,
  statEmojis
} from "./types.ts";

export default Platforms;
