import { describe, expect, it } from "vitest";
import { TikTok } from "./TikTok.ts";

describe("TikTok", () => {
  const tiktok = new TikTok();

  const valid_urls = [
    "https://www.tiktok.com/@user/video/123456789",
    "https://tiktok.com/@user/video/123456789",
    "https://m.tiktok.com/@user/video/123456789",
    "https://vm.tiktok.com/ZMhAbCdEf/",
    "https://www.tiktok.com/t/ZTAbCdEf/"
  ];

  const invalid_urls = [
    "https://nottiktok.com/@user/video/123",
    "https://example.com"
  ];

  it.each(valid_urls)("matches %s", (url) => {
    expect(tiktok.matchesUrl(url)).toBe(true);
  });

  it.each(invalid_urls)("rejects %s", (url) => {
    expect(tiktok.matchesUrl(url)).toBe(false);
  });

  it("extracts user and video id from detail pattern", () => {
    const detail_pattern = new URLPattern({
      hostname: "{(m|www|vm).}?tiktok.com",
      pathname: "/:tiktok_user/video/:tiktok_id{/}?"
    });
    const match = detail_pattern.exec(
      "https://www.tiktok.com/@cooluser/video/7234567890123456789"
    );
    expect(match?.pathname.groups.tiktok_user).toBe("@cooluser");
    expect(match?.pathname.groups.tiktok_id).toBe(
      "7234567890123456789"
    );
  });
});
