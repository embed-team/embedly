import { GENERIC_LINK_REGEX } from "./constants.ts";
import type { EmbedlyPlatformType } from "./types.ts";

/**
 * Check if content contains any link
 */
export function hasLink(content: string): boolean {
  return GENERIC_LINK_REGEX.test(content);
}

/**
 * Check if a URL is wrapped in spoiler tags (||url||)
 */
export function isSpoiler(url: string, content: string): boolean {
  return content
    .split("||")
    .some((part, ind) => ind % 2 === 1 && part.includes(url));
}

/**
 * Check if a URL is escaped with angle brackets (<url>)
 */
export function isEscaped(url: string, content: string): boolean {
  return content.includes(`<${url}>`);
}

/**
 * Data-driven platform detection - will be populated by main.ts
 * after platform instances are created
 */
export let getPlatformFromURL: (
  url: string
) => null | { type: EmbedlyPlatformType };

/**
 * Register the platform detection function (called from main.ts)
 */
export function registerPlatformDetector(
  detector: (url: string) => null | { type: EmbedlyPlatformType }
): void {
  getPlatformFromURL = detector;
}
