import { describe, expect, it } from "vitest";
import {
  type BaseEmbedData,
  type BaseEmbedDataWithoutPlatform,
  Embed,
  EmbedFlagNames
} from "./Embed.ts";

function make_embed_data(
  overrides?: Partial<BaseEmbedData>
): BaseEmbedData {
  return {
    platform: "Twitter",
    color: [29, 161, 242],
    emoji: "<:twitter:123>",
    name: "Test User",
    username: "testuser",
    profile_url: "https://x.com/testuser",
    avatar_url: "https://example.com/avatar.png",
    url: "https://x.com/testuser/status/123",
    timestamp: 1700000000,
    stats: {
      comments: 42,
      reposts: 100,
      likes: 1500,
      views: 50000
    },
    description: "hello world",
    ...overrides
  };
}

function make_secondary_data(
  overrides?: Partial<BaseEmbedDataWithoutPlatform>
): BaseEmbedDataWithoutPlatform {
  return {
    name: "Quoted User",
    username: "quoted",
    profile_url: "https://x.com/quoted",
    avatar_url: "https://example.com/quoted.png",
    url: "https://x.com/quoted/status/456",
    timestamp: 1700000000,
    description: "quoted text",
    ...overrides
  };
}

describe("Embed constructor", () => {
  it("assigns all fields from data", () => {
    const data = make_embed_data();
    const embed = new Embed(data);

    expect(embed.platform).toBe("Twitter");
    expect(embed.color).toEqual([29, 161, 242]);
    expect(embed.name).toBe("Test User");
    expect(embed.username).toBe("testuser");
    expect(embed.url).toBe("https://x.com/testuser/status/123");
    expect(embed.timestamp).toBe(1700000000);
    expect(embed.stats.likes).toBe(1500);
    expect(embed.description).toBe("hello world");
  });

  it("truncates media to 10 items", () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      media: { url: `https://example.com/${i}.jpg` }
    }));
    const embed = new Embed(make_embed_data({ media: items }));
    expect(embed.media).toHaveLength(10);
  });

  it("keeps media under 10 as-is", () => {
    const items = [
      { media: { url: "https://example.com/1.jpg" } },
      { media: { url: "https://example.com/2.jpg" } }
    ];
    const embed = new Embed(make_embed_data({ media: items }));
    expect(embed.media).toHaveLength(2);
  });
});

describe("Embed setters", () => {
  it("setDescription updates description", () => {
    const embed = new Embed(make_embed_data());
    embed.setDescription("new text");
    expect(embed.description).toBe("new text");
  });

  it("setMedia truncates to 10", () => {
    const embed = new Embed(make_embed_data());
    const items = Array.from({ length: 12 }, (_, i) => ({
      media: { url: `https://example.com/${i}.jpg` }
    }));
    embed.setMedia(items);
    expect(embed.media).toHaveLength(10);
  });

  it("setQuote stores quote data", () => {
    const embed = new Embed(make_embed_data());
    const quote = make_secondary_data();
    embed.setQuote(quote);
    expect(embed.quote?.name).toBe("Quoted User");
    expect(embed.quote?.description).toBe("quoted text");
  });

  it("setQuote truncates quote media to 10", () => {
    const embed = new Embed(make_embed_data());
    const items = Array.from({ length: 15 }, (_, i) => ({
      media: { url: `https://example.com/${i}.jpg` }
    }));
    embed.setQuote(make_secondary_data({ media: items }));
    expect(embed.quote?.media).toHaveLength(10);
  });

  it("setReplyingTo stores reply data", () => {
    const embed = new Embed(make_embed_data());
    const reply = make_secondary_data({ name: "Reply Author" });
    embed.setReplyingTo(reply);
    expect(embed.replying_to?.name).toBe("Reply Author");
  });

  it("setReplyingTo truncates reply media to 10", () => {
    const embed = new Embed(make_embed_data());
    const items = Array.from({ length: 15 }, (_, i) => ({
      media: { url: `https://example.com/${i}.jpg` }
    }));
    embed.setReplyingTo(make_secondary_data({ media: items }));
    expect(embed.replying_to?.media).toHaveLength(10);
  });
});

describe("Embed.NumberFormatter", () => {
  it("formats small numbers as-is", () => {
    expect(Embed.NumberFormatter.format(42)).toBe("42");
  });

  it("formats thousands with K", () => {
    expect(Embed.NumberFormatter.format(1500)).toBe("1.5K");
  });

  it("formats millions with M", () => {
    expect(Embed.NumberFormatter.format(2_500_000)).toBe("2.5M");
  });

  it("formats zero", () => {
    expect(Embed.NumberFormatter.format(0)).toBe("0");
  });
});

describe("Embed.getDiscordEmbed", () => {
  it("returns a container component", () => {
    const embed = new Embed(make_embed_data());
    const result = Embed.getDiscordEmbed(embed);
    expect(result).toBeDefined();
    expect(result.type).toBe(17);
  });

  it("sets accent color", () => {
    const embed = new Embed(make_embed_data());
    const result = Embed.getDiscordEmbed(embed);
    expect(result.accent_color).toBeDefined();
  });

  it("sets spoiler when flag is set", () => {
    const embed = new Embed(make_embed_data());
    const result = Embed.getDiscordEmbed(embed, {
      [EmbedFlagNames.Spoiler]: true
    });
    expect(result.spoiler).toBe(true);
  });

  it("media only returns null without media", () => {
    const embed = new Embed(make_embed_data());
    const result = Embed.getDiscordEmbed(embed, {
      [EmbedFlagNames.MediaOnly]: true
    });
    expect(result).toBeNull();
  });

  it("media only returns gallery with media", () => {
    const embed = new Embed(
      make_embed_data({
        media: [{ media: { url: "https://example.com/1.jpg" } }]
      })
    );
    const result = Embed.getDiscordEmbed(embed, {
      [EmbedFlagNames.MediaOnly]: true
    });
    expect(result).toBeDefined();
    expect(result!.type).toBe(12);
  });

  it("source only strips quote and reply", () => {
    const embed = new Embed(make_embed_data());
    embed.setQuote(make_secondary_data());
    embed.setReplyingTo(make_secondary_data());
    const result = Embed.getDiscordEmbed(embed, {
      [EmbedFlagNames.SourceOnly]: true
    });
    expect(result).toBeDefined();
    expect(result.type).toBe(17);
  });

  it("includes separator and secondary section for quotes", () => {
    const embed = new Embed(make_embed_data());
    embed.setQuote(make_secondary_data());
    const result = Embed.getDiscordEmbed(embed);
    const separators = result.components.filter(
      (c: any) => c.type === 14
    );
    expect(separators.length).toBeGreaterThanOrEqual(1);
  });

  it("includes separator and secondary section for replies", () => {
    const embed = new Embed(make_embed_data());
    embed.setReplyingTo(make_secondary_data());
    const result = Embed.getDiscordEmbed(embed);
    const separators = result.components.filter(
      (c: any) => c.type === 14
    );
    expect(separators.length).toBeGreaterThanOrEqual(1);
  });
});
