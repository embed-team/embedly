# Music

Cross-platform track and album links for Spotify, Apple Music, Tidal, and Amazon Music.

```http
GET /v1/links?url=https%3A%2F%2Fopen.spotify.com%2Falbum%2F6TnYUZpDRbl6GiREL8Md4F
```

The response contains the requested `source`, normalized `item` metadata, and a `links` entry for each provider. Each link reports `matched`, `not_found`, or `unavailable`. Matched links include their URL and the check used: `source`, `isrc`, `upc`, or `tracklist`.

Tracks match by ISRC. When a provider does not expose ISRCs, tracks can match through their position in a verified album. Albums match by UPC or by their full ordered tracklist, including durations and explicit-content markers where available. Different UPCs can still match the same tracklist.

Verified mappings are cached under each provider ID and their shared recording or album identity. Send `Cache-Control: no-cache` to refresh a mapping. Catalog lookups use the US storefront internally; the API has no country parameter.

For local development, configure the four variables in `.env.example` in `apps/music/.env`, then run `pnpm --filter @embedly/music dev`. The Worker listens on `127.0.0.1:8791` and uses local KV storage. Spotify and Tidal use client credentials. Apple Music uses its public web data; Amazon Music uses guest search and public structured metadata.

The Wrangler configuration prepares `music.embeds.media` and a `CACHE` KV binding. Neither is provisioned by local development. Deploying requires those resources and the provider secrets.

Embedly's API calls the `embedly-music` Worker through its `MUSIC` service binding. For local embeds, keep this Worker running alongside `pnpm --filter @embedly/api dev`; Wrangler connects the binding locally. The bot continues to use Embedly's existing API.
