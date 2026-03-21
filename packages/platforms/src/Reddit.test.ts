import { describe, expect, it } from "vitest";
import { Reddit } from "./Reddit.ts";

describe("Reddit", () => {
  const reddit = new Reddit();

  const valid_urls = [
    "https://www.reddit.com/r/javascript/comments/abc123/some_title",
    "https://old.reddit.com/r/javascript/comments/abc123/",
    "https://reddit.com/r/javascript/comments/abc123",
    "https://www.reddit.com/r/pics/s/AbCdEfGhIj",
    "https://reddit.com/r/pics/s/AbCdEfGhIj/",
    "https://redd.it/abc123",
    "https://redd.it/abc123/"
  ];

  const invalid_urls = [
    "https://www.reddit.com/r/javascript",
    "https://www.reddit.com/user/someone",
    "https://notreddit.com/r/test/comments/abc",
    "https://example.com"
  ];

  it.each(valid_urls)("matches %s", (url) => {
    expect(reddit.matchesUrl(url)).toBe(true);
  });

  it.each(invalid_urls)("rejects %s", (url) => {
    expect(reddit.matchesUrl(url)).toBe(false);
  });
});
