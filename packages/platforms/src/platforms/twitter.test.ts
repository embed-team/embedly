import { describe, expect, it } from "vitest";

import { Twitter } from "./twitter";

describe("Twitter.match", () => {
  it.each([
    ["https://x.com/user/status/1234567890"],
    ["https://twitter.com/user/status/1234567890"],
    ["https://mobile.twitter.com/user/status/1234567890"],
    ["x.com/user/status/1234567890"],
    ["https://x.com/user/statuses/1234567890"],
    ["https://x.com/user/status/1234567890?s=20"],
    ["https://x.com/user/status/1234567890/photo/1"],
    ["https://x.com/user/status/1234567890#m"],
    ["https://x.com/user/status/1234567890**"],
    ["https://x.com/user/status/1234567890_"],
    ["https://x.com/user/status/1234567890__"],
    ["https://x.com/user/status/1234567890~~"],
  ])("matches %s", async (url) => {
    await expect(Twitter.match(url)).resolves.toBe("1234567890");
  });

  it.each([
    ["https://x.com/user"],
    ["https://x.com/user/status/"],
    ["https://x.com/user/status/abc"],
    ["https://example.com/user/status/1234567890"],
  ])("does not match %s", async (url) => {
    await expect(Twitter.match(url)).resolves.toBeNull();
  });
});
