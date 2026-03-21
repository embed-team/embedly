import { beforeAll, describe, expect, it } from "vitest";
import { TruthSocial } from "./TruthSocial.ts";

beforeAll(() => {
  process.env.DISCORD_BOT_TOKEN = "test-token";
  process.env.EMBEDLY_API_DOMAIN = "localhost";
});

describe("TruthSocial", () => {
  const ts = new TruthSocial();

  const valid_urls = [
    "https://truthsocial.com/@realDonaldTrump/posts/116268334535345382",
    "https://truthsocial.com/@user/posts/123456/",
    "https://www.truthsocial.com/@user/posts/123456"
  ];

  const invalid_urls = [
    "https://truthsocial.com/@user",
    "https://truthsocial.com/@user/following",
    "https://nottruthsocial.com/@user/posts/123",
    "https://example.com"
  ];

  it.each(valid_urls)("matches %s", (url) => {
    expect(ts.matchesUrl(url)).toBe(true);
  });

  it.each(invalid_urls)("rejects %s", (url) => {
    expect(ts.matchesUrl(url)).toBe(false);
  });

  it("extracts status id", async () => {
    const id = await ts.parsePostId(
      "https://truthsocial.com/@realDonaldTrump/posts/116268334535345382"
    );
    expect(id).toBe("116268334535345382");
  });

  it("transforms raw data correctly", () => {
    const raw = {
      id: "116268334535345382",
      created_at: "2026-03-21T17:26:31.318Z",
      url: "https://truthsocial.com/@realDonaldTrump/116268334535345382",
      content: "<p>Hello world</p>",
      account: {
        display_name: "Donald J. Trump",
        username: "realDonaldTrump",
        url: "https://truthsocial.com/@realDonaldTrump",
        avatar: "https://example.com/avatar.jpeg"
      },
      replies_count: 5221,
      reblogs_count: 4472,
      favourites_count: 15994,
      media_attachments: []
    };

    const data = ts.transformRawData(raw);
    expect(data.platform).toBe("Truth Social");
    expect(data.name).toBe("Donald J. Trump");
    expect(data.username).toBe("realDonaldTrump");
    expect(data.description).toBe("Hello world");
    expect(data.stats?.comments).toBe(5221);
    expect(data.stats?.reposts).toBe(4472);
    expect(data.stats?.likes).toBe(15994);
    expect(data.timestamp).toBe(
      Math.floor(new Date("2026-03-21T17:26:31.318Z").getTime() / 1000)
    );
  });

  it("strips html from content", () => {
    const raw = {
      created_at: "2026-03-21T00:00:00Z",
      url: "https://truthsocial.com/@user/123",
      content: "<p>First paragraph</p><p>Second &amp; third</p>",
      account: {
        display_name: "User",
        username: "user",
        url: "https://truthsocial.com/@user",
        avatar: "https://example.com/avatar.png"
      },
      replies_count: 0,
      reblogs_count: 0,
      favourites_count: 0
    };

    const data = ts.transformRawData(raw);
    expect(data.description).toBe("First paragraph\n\nSecond & third");
  });
});
