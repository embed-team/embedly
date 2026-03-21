import { describe, expect, it } from "vitest";
import { Instagram } from "./Instagram.ts";

describe("Instagram", () => {
  const instagram = new Instagram();

  const valid_urls = [
    "https://www.instagram.com/p/ABC123/",
    "https://instagram.com/p/ABC123",
    "https://www.instagram.com/user/p/ABC123/",
    "https://www.instagram.com/reel/ABC123/",
    "https://www.instagram.com/reels/ABC123/",
    "https://www.instagram.com/user/reel/ABC123",
    "https://www.instagram.com/stories/ABC123/",
    "https://www.instagram.com/share/ABC123/",
    "https://www.instagram.com/user/share/ABC123"
  ];

  const invalid_urls = [
    "https://instagram.com/user",
    "https://instagram.com/user/followers",
    "https://notinstagram.com/p/ABC123",
    "https://example.com"
  ];

  it.each(valid_urls)("matches %s", (url) => {
    expect(instagram.matchesUrl(url)).toBe(true);
  });

  it.each(invalid_urls)("rejects %s", (url) => {
    expect(instagram.matchesUrl(url)).toBe(false);
  });

  it("extracts shortcode", () => {
    const match = instagram.pattern.exec(
      "https://www.instagram.com/p/CxYz123_Ab/"
    );
    expect(match?.pathname.groups.ig_shortcode).toBe("CxYz123_Ab");
  });

  it("extracts shortcode with user prefix", () => {
    const match = instagram.pattern.exec(
      "https://www.instagram.com/natgeo/reel/CxYz123/"
    );
    expect(match?.pathname.groups.ig_shortcode).toBe("CxYz123");
    expect(match?.pathname.groups.user).toBe("natgeo");
  });
});
