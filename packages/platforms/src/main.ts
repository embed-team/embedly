import { CBC } from "./CBC.ts";
import { Instagram } from "./Instagram.ts";
import { NYTimes } from "./NYTimes.ts";
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
  [EmbedlyPlatformType.Reddit]: new Reddit(),
  [EmbedlyPlatformType.NYTimes]: new NYTimes()
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

export function getPlatformFromURL(
  url: string
): null | { type: EmbedlyPlatformType } {
  for (const [name, platform] of Object.entries(Platforms)) {
    if (platform.matchesUrl(url)) {
      return { type: name as EmbedlyPlatformType };
    }
  }
  return null;
}

export { CF_CACHE_OPTIONS, GENERIC_LINK_REGEX } from "./constants.ts";
export { type CloudflareEnv, EmbedlyPlatform } from "./Platform.ts";
export {
  EmbedlyPlatformType,
  type Emojis,
  emojis,
  type StatEmojis,
  statEmojis
} from "./types.ts";
export { hasLink, isEscaped, isSpoiler } from "./utils.ts";

export default Platforms;
