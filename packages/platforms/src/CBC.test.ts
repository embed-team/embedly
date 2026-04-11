import { describe, expect, it } from "vitest";
import { CBC } from "./CBC.ts";

describe("CBC", () => {
  const cbc = new CBC();

  const valid_urls = [
    "https://www.cbc.ca/news/canada/1.7654321",
    "https://cbc.ca/news/1.7654321",
    "https://www.cbc.ca/news/politics/some-article-1.7654321/"
  ];

  const invalid_urls = [
    "https://notcbc.ca/news/1.123",
    "https://example.com"
  ];

  it.each(valid_urls)("matches %s", (url) => {
    expect(cbc.matchesUrl(url)).toBe(true);
  });

  it.each(invalid_urls)("rejects %s", (url) => {
    expect(cbc.matchesUrl(url)).toBe(false);
  });

  it("extracts cbc id", () => {
    const match = cbc.regex.exec(
      "https://www.cbc.ca/news/canada/1.7654321"
    );
    expect(match?.groups?.cbc_id).toBe("1.7654321");
  });
});
