import { EmbedlyPlatformType } from "@embedly/types";
import {
  CBC_REGEX,
  GENERIC_LINK_REGEX,
  IG_REGEX,
  SPOILER_LINK_REGEX,
  THREADS_REGEX,
  TIKTOK_REGEX_MAIN,
  TWITTER_REGEX
} from "./regex.ts";

export function hasLink(content: string) {
  return GENERIC_LINK_REGEX.test(content);
}

export function isSpoiler(url: string, content: string) {
  return SPOILER_LINK_REGEX(url).test(content);
}

export function getPlatformFromURL(
  url: string
): null | { type: EmbedlyPlatformType } {
  if (TWITTER_REGEX.test(url))
    return { type: EmbedlyPlatformType.Twitter };
  if (IG_REGEX.test(url))
    return { type: EmbedlyPlatformType.Instagram };
  if (TIKTOK_REGEX_MAIN.test(url))
    return { type: EmbedlyPlatformType.TikTok };
  if (CBC_REGEX.test(url)) {
    return { type: EmbedlyPlatformType.CBC };
  }
  if (THREADS_REGEX.test(url)) {
    return { type: EmbedlyPlatformType.Threads };
  }
  return null;
}
