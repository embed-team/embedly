export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (
      request.method !== "GET" ||
      url.protocol !== "https:" ||
      url.hostname !== "www.instagram.com"
    ) {
      return new Response(null, { status: 400 });
    }

    const post = url.pathname.match(/^\/(?:p|reel)\/([A-Za-z0-9_-]+)\/?$/);
    const headers = new Headers(request.headers);
    if (post) headers.delete("Cookie");
    const response = await fetch(new Request(request, { headers }));
    let proxied = new Response(response.body, response);
    if (post && response.ok) {
      let media: unknown;
      let chunks: string[] = [];
      const rewritten = new HTMLRewriter()
        .on('script[type="application/json"][data-sjs]', {
          element(element) {
            chunks = [];
            element.onEndTag(() => {
              const script = chunks.join("");
              if (
                !script.includes("RelayPrefetchedStreamCache") ||
                !script.includes("PolarisLoggedOutDesktopWWWPostRootContentQueryRelayPreloader_")
              ) {
                return;
              }
              const data = JSON.parse(script);
              const requireItems = data?.require?.[0]?.[3]?.[0]?.__bbox?.require;
              if (!Array.isArray(requireItems)) return;
              const relay = requireItems.find(
                (item) =>
                  item[0] === "RelayPrefetchedStreamCache" &&
                  item[3]?.[0]?.startsWith(
                    "adp_PolarisLoggedOutDesktopWWWPostRootContentQueryRelayPreloader_",
                  ),
              );
              const candidate =
                relay?.[3]?.[1]?.__bbox?.result?.data?.xig_polaris_media?.if_not_gated_logged_out;
              if (
                candidate?.code === post[1] &&
                candidate.user &&
                candidate.user.is_private !== true &&
                candidate.audience == null &&
                candidate.custom_list_info == null
              ) {
                media = candidate;
              }
            });
          },
          text(chunk) {
            chunks.push(chunk.text);
          },
        })
        .transform(response);
      await rewritten.body?.pipeTo(new WritableStream());
      proxied = media ? Response.json(media) : new Response(null, { status: 502 });
    }
    if (request.cf?.colo) proxied.headers.set("X-Embedly-Colo", request.cf.colo);
    return proxied;
  },
} satisfies ExportedHandler;
