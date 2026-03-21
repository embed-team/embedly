import { describe, expect, it } from "vitest";
import { Threads } from "./Threads.ts";

describe("Threads", () => {
  const threads = new Threads();

  const valid_urls = [
    "https://www.threads.net/@user/post/CxYz123_Ab",
    "https://threads.net/@user/post/CxYz123_Ab/",
    "https://www.threads.net/@some.user/post/ABC123"
  ];

  const invalid_urls = [
    "https://threads.net/@user",
    "https://threads.net/@user/replies",
    "https://notthreads.net/@user/post/ABC",
    "https://example.com"
  ];

  it.each(valid_urls)("matches %s", (url) => {
    expect(threads.matchesUrl(url)).toBe(true);
  });

  it.each(invalid_urls)("rejects %s", (url) => {
    expect(threads.matchesUrl(url)).toBe(false);
  });

  it("extracts shortcode and username", () => {
    const match = threads.pattern.exec(
      "https://www.threads.net/@zuck/post/CxYz123_Ab"
    );
    expect(match?.pathname.groups.thread_shortcode).toBe("CxYz123_Ab");
    expect(match?.pathname.groups.username).toBe("zuck");
  });
});
