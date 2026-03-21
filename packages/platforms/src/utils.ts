import { createHmac } from "node:crypto";
import type { URLPatternResult } from "node:url";
import { GENERIC_LINK_REGEX } from "./constants.ts";

export function hasLink(content: string): boolean {
  return GENERIC_LINK_REGEX.test(content);
}

export function isSpoiler(url: string, content: string): boolean {
  return content
    .split("||")
    .some((part, ind) => ind % 2 === 1 && part.includes(url));
}

export function isEscaped(url: string, content: string): boolean {
  return content.includes(`<${url}>`);
}

export function signProxyUrl(url: string): string {
  const signature = createHmac("sha256", process.env.DISCORD_BOT_TOKEN!)
    .update(url)
    .digest("hex");
  return `https://${process.env.EMBEDLY_API_DOMAIN!}/api/_image?url=${url}&sig=${signature}`;
}

export function validatePatternMatch(
  match: URLPatternResult | null,
  errorMessage?: string
): asserts match is URLPatternResult {
  if (match === null) {
    throw new Error(
      errorMessage ?? "Invalid URL: pattern match failed"
    );
  }
}
