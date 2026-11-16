import { request, UpstreamError } from "./http";

export async function deezerPreview(isrc: string) {
  const code = isrc.toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(code)) return null;
  const response = await request(`https://api.deezer.com/track/isrc:${code}`);
  // SAFETY: Deezer's ISRC lookup returns track metadata or an error object.
  const track = (await response.json()) as {
    isrc?: string;
    preview?: string;
    error?: { code: number };
  };
  if (track.error) {
    if (track.error.code === 800) return null;
    throw new UpstreamError("Deezer preview lookup failed");
  }
  if (!track.preview) return null;
  const preview = new URL(track.preview);
  if (
    track.isrc?.toUpperCase() !== code ||
    preview.protocol !== "https:" ||
    !preview.hostname.endsWith(".dzcdn.net")
  ) {
    throw new UpstreamError("Deezer returned an invalid preview");
  }
  return preview.href;
}
