<p align="center">
  <img src="https://bot.embeds.media/og.png" alt="Embedly" />
</p>

<h1 align="center">Embedly</h1>

<p align="center">
  <em>The missing link between social media and Discord.</em>
</p>

<p align="center">
  <a href="https://bot.embeds.media/invite">Invite to Discord</a>
  ·
  <a href="https://bot.embeds.media/docs">Documentation</a>
  ·
  <a href="https://bot.embeds.media">Website</a>
</p>

---

## Share links that actually work, the way they should be.

Embedly replaces Discord's broken native embeds with rich, accurate ones. Paste a supported link in any server or DM and Embedly fetches the content directly: media, stats, reply chains, quote posts, all rendered with Discord's component system.

## Using Embedly

There are three ways to trigger an embed.

### Messages

Embedly automatically detects and embeds links as they're posted, no command needed. Multiple links in a single message are all processed. The first link gets a reply, and each additional link is sent as a follow-up in the same channel. Once Embedly has posted, Discord's native embed preview is suppressed.

If a link is wrapped in Discord spoiler tags, the embed is spoilered too. Wrap a link in angle brackets to prevent Embedly from embedding it.

### Slash command

Use `/embed` with a URL and optional display flags to manually create a rich embed from any supported link. Available in servers, DMs, and group DMs.

```
/embed url:<link> [media_only] [source_only] [spoiler]
```

| Option | Description |
| --- | --- |
| `url` | The link to embed. Must be from a supported platform. |
| `media_only` | Show only the media, with no text, author, or stats. |
| `source_only` | Show only the source post. Hides any quoted or replied-to content. |
| `spoiler` | Wrap the embed in a spoiler. Users must click to reveal it. |

### Context menu

Right-click any existing message (or long-press on mobile), then go to **Apps → Embed Links**. Useful if Embedly missed a link, or the message predates Embedly being in the server.

## Supported platforms

| Platform | What it embeds |
| --- | --- |
| **Twitter / X** | Tweets, quote tweets, reply chains, and articles. Images, video, and GIFs. |
| **Instagram** | Posts, reels, stories, and carousels. |
| **Reddit** | Posts with text, images, galleries, and video. |
| **Threads** | Posts with text, images, carousels, and video. |
| **TikTok** | Videos with caption and stats. |

See the [platforms docs](https://bot.embeds.media/docs/platforms) for full details on what each platform supports.

## License

[Elastic License 2.0](./LICENSE).
