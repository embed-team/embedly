import { createHmac } from "node:crypto";

export function signProxyURL(url: string, path = "/api/_image") {
  const signature = createHmac("sha256", process.env.EMBEDLY_AUTH_SECRET!)
    .update(url)
    .digest("hex");
  const proxyURL = new URL(path, process.env.EMBEDLY_API_DOMAIN);
  proxyURL.searchParams.set("url", url);
  proxyURL.searchParams.set("sig", signature);
  return proxyURL.href;
}
