import { describe, expect, it } from "vitest";
import { getPlatformFromURL } from "./main.ts";
import { EmbedlyPlatformType } from "./types.ts";
import { hasLink, isEscaped, isSpoiler } from "./utils.ts";

describe("getPlatformFromURL", () => {
  it("detects twitter", () => {
    const result = getPlatformFromURL("https://x.com/user/status/123");
    expect(result?.type).toBe(EmbedlyPlatformType.Twitter);
  });

  it("detects instagram", () => {
    const result = getPlatformFromURL(
      "https://www.instagram.com/p/ABC123/"
    );
    expect(result?.type).toBe(EmbedlyPlatformType.Instagram);
  });

  it("detects tiktok", () => {
    const result = getPlatformFromURL(
      "https://www.tiktok.com/@user/video/123"
    );
    expect(result?.type).toBe(EmbedlyPlatformType.TikTok);
  });

  it("detects reddit", () => {
    const result = getPlatformFromURL(
      "https://www.reddit.com/r/test/comments/abc123/title"
    );
    expect(result?.type).toBe(EmbedlyPlatformType.Reddit);
  });

  it("detects threads", () => {
    const result = getPlatformFromURL(
      "https://www.threads.net/@user/post/ABC123"
    );
    expect(result?.type).toBe(EmbedlyPlatformType.Threads);
  });

  it("detects cbc", () => {
    const result = getPlatformFromURL(
      "https://www.cbc.ca/news/1.7654321"
    );
    expect(result?.type).toBe(EmbedlyPlatformType.CBC);
  });

  it("returns null for unknown urls", () => {
    expect(getPlatformFromURL("https://example.com")).toBeNull();
    expect(getPlatformFromURL("https://google.com")).toBeNull();
  });
});

describe("hasLink", () => {
  it("detects urls in text", () => {
    expect(hasLink("check out https://example.com")).toBe(true);
    expect(hasLink("visit http://test.org/page")).toBe(true);
    expect(hasLink("go to example.com/path")).toBe(true);
  });

  it("rejects plain text", () => {
    expect(hasLink("no links here")).toBe(false);
    expect(hasLink("just some words")).toBe(false);
  });
});

describe("isSpoiler", () => {
  it("detects url inside spoiler tags", () => {
    expect(
      isSpoiler(
        "https://x.com/user/status/123",
        "look ||https://x.com/user/status/123||"
      )
    ).toBe(true);
  });

  it("returns false when url is not spoilered", () => {
    expect(
      isSpoiler(
        "https://x.com/user/status/123",
        "https://x.com/user/status/123"
      )
    ).toBe(false);
  });
});

describe("isEscaped", () => {
  it("detects escaped urls", () => {
    expect(
      isEscaped(
        "https://x.com/user/status/123",
        "<https://x.com/user/status/123>"
      )
    ).toBe(true);
  });

  it("returns false for non-escaped urls", () => {
    expect(
      isEscaped(
        "https://x.com/user/status/123",
        "https://x.com/user/status/123"
      )
    ).toBe(false);
  });
});
