export const URL_RE =
  /\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()[\]{};:'".,<>?«»""'']))/gi;

export function extractURLs(content: string): string[] {
  return content.match(URL_RE) ?? [];
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
