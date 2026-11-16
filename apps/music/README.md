# Music

Cross-platform track and album links for Spotify, Apple Music, Tidal, and Amazon Music.

```http
GET /v1/links?url=https%3A%2F%2Fopen.spotify.com%2Falbum%2F6TnYUZpDRbl6GiREL8Md4F
```

The response contains the requested `source`, normalized `item` metadata, and a `links` entry for each provider. Each link reports `matched`, `not_found`, or `unavailable`. Matched links include their URL and the check used: `source`, `isrc`, `upc`, or `tracklist`.

Tracks match by ISRC. When a provider does not expose ISRCs, tracks can match through their position in a verified album. Albums match by UPC or by their full ordered tracklist, including durations and explicit-content markers where available. Different UPCs can still match the same tracklist.

Mappings are cached by provider ID and recording or album identity. Send `Cache-Control: no-cache` to refresh a mapping. Catalog lookups use the US storefront.
