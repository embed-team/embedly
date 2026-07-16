export const URL_RE =
  /\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()[\]{};:'".,<>?«»""'']))/gi;

export interface URLMatch {
  url: string;
  index: number;
  endIndex: number;
}

export function extractURLs(content: string): URLMatch[] {
  return [...content.matchAll(URL_RE)].map((match) => {
    const index = match.index ?? 0;
    const url = match[0].endsWith("||") ? match[0].slice(0, -2) : match[0];
    return {
      url,
      index,
      endIndex: index + url.length,
    };
  });
}

export function isSpoiler(url: string, content: string): boolean {
  return content.split("||").some((part, ind) => ind % 2 === 1 && part.includes(url));
}

export function isEscaped(url: string, content: string): boolean {
  return content.includes(`<${url}>`);
}

export function truncate(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
}
