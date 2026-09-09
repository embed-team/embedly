import { createHmac } from "node:crypto";

export function signProxyURL(url: string) {
  const signature = createHmac("sha256", process.env.EMBEDLY_AUTH_SECRET!)
    .update(url)
    .digest("hex");
  const proxyURL = new URL("/api/_image", process.env.EMBEDLY_API_DOMAIN);
  proxyURL.searchParams.set("url", url);
  proxyURL.searchParams.set("sig", signature);
  return proxyURL.href;
}
