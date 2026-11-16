export class UpstreamError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

export async function request(url: string | URL, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    await response.body?.cancel();
    throw new UpstreamError(`Provider returned HTTP ${response.status}`, response.status);
  }
  return response;
}

export async function clientToken(url: string, id: string, secret: string) {
  const response = await request(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  // SAFETY: Both provider OAuth endpoints return the standard client-credentials token response.
  const token = (await response.json()) as { access_token?: string };
  if (!token.access_token) throw new UpstreamError("Provider returned no access token");
  return token.access_token;
}

export async function readScripts(url: string, selector: string, userAgent?: string) {
  const headers = new Headers({ Accept: "text/html" });
  if (userAgent) headers.set("User-Agent", userAgent);
  const response = await request(url, { headers });
  if (!response.headers.get("Content-Type")?.includes("text/html")) {
    await response.body?.cancel();
    throw new UpstreamError("Provider returned unexpected content");
  }
  const scripts: string[] = [];
  const rewritten = new HTMLRewriter()
    .on(selector, {
      element() {
        scripts.push("");
      },
      text(chunk) {
        scripts[scripts.length - 1] += chunk.text;
      },
    })
    .transform(response);
  await rewritten.body!.pipeTo(new WritableStream());
  if (scripts.length === 0) throw new UpstreamError("Provider returned no structured music data");
  return scripts;
}

export function durationMs(value: string) {
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!match) throw new UpstreamError("Provider returned an invalid duration");
  return (Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)) * 1000;
}
