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

    const response = await fetch(request);
    const proxied = new Response(response.body, response);
    if (request.cf?.colo) proxied.headers.set("X-Embedly-Colo", request.cf.colo);
    return proxied;
  },
} satisfies ExportedHandler;
