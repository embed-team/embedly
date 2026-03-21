import { describe, expect, it } from "vitest";
import { Twitter } from "./Twitter.ts";

describe("Twitter", () => {
  const twitter = new Twitter();

  const valid_urls = [
    "https://twitter.com/user/status/123456789",
    "https://x.com/user/status/123456789",
    "https://www.twitter.com/user/status/123456789",
    "https://www.x.com/user/status/123456789",
    "https://x.com/user/statuses/123456789",
    "https://x.com/user/status/123456789/",
    "https://mobile.x.com/user/status/123456789",
    "https://mobile.twitter.com/user/status/123456789"
  ];

  const invalid_urls = [
    "https://nottwitter.com/user/status/123",
    "https://x.com/user/likes",
    "https://twitter.com/user",
    "https://example.com"
  ];

  it.each(valid_urls)("matches %s", (url) => {
    expect(twitter.matchesUrl(url)).toBe(true);
  });

  it.each(invalid_urls)("rejects %s", (url) => {
    expect(twitter.matchesUrl(url)).toBe(false);
  });

  it("extracts tweet id", () => {
    const match = twitter.pattern.exec(
      "https://x.com/elonmusk/status/1234567890"
    );
    expect(match?.pathname.groups.tweet_id).toBe("1234567890");
  });
});
