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

export function validateRegexMatch(
  match: RegExpExecArray | null,
  errorMessage?: string
): asserts match is RegExpExecArray & {
  groups: Record<string, string>;
} {
  if (match === null || match.groups === undefined) {
    throw new Error(errorMessage ?? "Invalid URL: regex match failed");
  }
}
