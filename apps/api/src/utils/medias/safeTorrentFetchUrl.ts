/**
 * Server-side .torrent fetch SSRF hardening: block loopback and cloud metadata,
 * while still allowing LAN indexer URLs typical in homelab setups.
 */
export function isHttpUrlSafeForServerTorrentFetch(urlString: string): boolean {
  let u: URL;
  try {
    u = new URL(urlString);
  } catch {
    return false;
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") return false;

  const host = u.hostname.toLowerCase();

  if (host === "localhost" || host === "0.0.0.0") return false;
  if (host === "::1" || host === "[::1]") return false;
  if (host === "169.254.169.254") return false;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const [, a] = ipv4;
    const ai = Number(a);
    if (ai === 127) return false;
    if (ai === 0) return false;
  }

  return true;
}

export class MagnetRedirectError extends Error {
  constructor(public readonly magnetUrl: string) {
    super("Redirect to magnet link");
    this.name = "MagnetRedirectError";
  }
}

/**
 * Follow redirects manually so each hop is checked against {@link isHttpUrlSafeForServerTorrentFetch}
 * (mitigates open redirects pointing at loopback/metadata).
 * Throws {@link MagnetRedirectError} if a redirect target is a magnet link.
 */
export async function fetchHttpWithSafeRedirects(
  initialUrl: string,
  init: Omit<RequestInit, "redirect"> & { maxRedirects?: number },
): Promise<Response> {
  const max = init.maxRedirects ?? 5;
  const { maxRedirects: _m, ...reqInit } = init;
  let url = initialUrl;

  for (let i = 0; i <= max; i++) {
    if (!isHttpUrlSafeForServerTorrentFetch(url)) {
      throw new Error("URL not allowed");
    }
    const res = await fetch(url, { ...reqInit, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc?.trim()) throw new Error("Redirect without Location");
      const next = new URL(loc.trim(), url).href;
      if (next.startsWith("magnet:")) {
        throw new MagnetRedirectError(next);
      }
      url = next;
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects");
}

