import { parse } from "node-html-parser";

export type FlareSolverrCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
};

export type FlareSolverrSolution = {
  userAgent: string;
  cookies: FlareSolverrCookie[];
  /** The fully-rendered HTML returned by FlareSolverr (JS executed). Useful for SPA sites. */
  response?: string;
};

export type HttpTrackerStats = {
  uploadedGo: number | null;
  downloadedGo: number | null;
  ratio: number | null;
};

/** Common CSRF cookie names and the header they map to (double-submit pattern). */
const CSRF_COOKIE_HEADERS: [cookieName: string, headerName: string][] = [
  ["__csrf", "csrf-token"],
  ["XSRF-TOKEN", "x-xsrf-token"],
  ["_csrf", "x-csrf-token"],
  ["csrf_token", "x-csrf-token"],
];

/**
 * Simple cookie jar that survives fetch redirect chains.
 * Initialized from FlareSolverr cookies so CF clearance is already present.
 */
export class CookieJar {
  private cookies = new Map<string, string>();

  init(cookies: FlareSolverrCookie[]): void {
    for (const c of cookies) {
      this.cookies.set(c.name, c.value);
    }
  }

  get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  absorb(headers: Headers): void {
    // getSetCookie() is the Node 18+ / Bun API for multi-value Set-Cookie headers.
    const setCookies: string[] =
      typeof (headers as any).getSetCookie === "function"
        ? (headers as any).getSetCookie()
        : ([headers.get("set-cookie")].filter(Boolean) as string[]);

    for (const header of setCookies) {
      this.parseSetCookie(header);
    }
  }

  /** Build a map of CSRF headers from known cookie patterns found in the jar. */
  csrfHeaders(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [cookieName, headerName] of CSRF_COOKIE_HEADERS) {
      const value = this.cookies.get(cookieName);
      if (value) result[headerName] = decodeURIComponent(value);
    }
    return result;
  }

  private parseSetCookie(header: string): void {
    const [nameValue] = header.split(";");
    if (!nameValue) return;
    const eqIdx = nameValue.indexOf("=");
    if (eqIdx === -1) return;
    const name = nameValue.substring(0, eqIdx).trim();
    const value = nameValue.substring(eqIdx + 1).trim();
    if (name) this.cookies.set(name, value);
  }

  serialize(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }
}

/**
 * Fetch a URL with the cookie jar, following redirects manually so
 * Set-Cookie headers from each hop are captured into the jar.
 */
export async function httpFetch(
  url: string,
  options: {
    method?: string;
    body?: string;
    contentType?: string;
    extraHeaders?: Record<string, string>;
    jar: CookieJar;
    userAgent: string;
    maxRedirects?: number;
  },
): Promise<{ html: string; finalUrl: string; status: number }> {
  const {
    jar,
    userAgent,
    method = "GET",
    body,
    contentType,
    extraHeaders,
    maxRedirects = 10,
  } = options;

  const headers: Record<string, string> = {
    "User-Agent": userAgent,
    Cookie: jar.serialize(),
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    ...extraHeaders,
  };
  if (contentType) headers["Content-Type"] = contentType;

  const response = await fetch(url, {
    method,
    body: body ?? undefined,
    headers,
    redirect: "manual",
  });

  jar.absorb(response.headers);

  if (response.status >= 300 && response.status < 400) {
    if (maxRedirects <= 0) throw new Error(`Too many redirects from ${url}`);
    const location = response.headers.get("location");
    if (!location)
      throw new Error(`Redirect with no Location header from ${url}`);
    const nextUrl = new URL(location, url).href;
    return httpFetch(nextUrl, {
      ...options,
      method: "GET",
      body: undefined,
      contentType: undefined,
      extraHeaders: undefined,
      maxRedirects: maxRedirects - 1,
    });
  }

  const html = await response.text();
  return { html, finalUrl: url, status: response.status };
}

/**
 * GET the login page, extract the form (including any hidden CSRF fields),
 * then POST credentials. Returns the HTML of the post-login destination page.
 *
 * Automatically detects common CSRF cookie patterns (__csrf, XSRF-TOKEN, etc.)
 * and sends them as the corresponding header on the POST (double-submit pattern).
 *
 * `credentials` is a map of form field names to values, e.g.:
 *   { username: 'foo', password: 'bar' }
 */
async function httpLogin(options: {
  loginPageUrl: string;
  formSelector: string;
  credentials: Record<string, string>;
  jar: CookieJar;
  userAgent: string;
}): Promise<{ html: string; finalUrl: string }> {
  const { loginPageUrl, formSelector, credentials, jar, userAgent } = options;

  // Step 1: GET the login page — FlareSolverr already cleared CF, jar has clearance cookies.
  const { html: loginHtml, finalUrl: loginFinalUrl } = await httpFetch(
    loginPageUrl,
    { jar, userAgent },
  );

  const root = parse(loginHtml);
  const form = root.querySelector(formSelector);
  if (!form)
    throw new Error(
      `Login form not found (${formSelector}) on ${loginPageUrl}`,
    );

  // Step 2: Collect hidden fields (CSRF tokens etc.) then add credentials.
  const body = new URLSearchParams();
  for (const input of form.querySelectorAll('input[type="hidden"]')) {
    const name = input.getAttribute("name");
    const value = input.getAttribute("value") ?? "";
    if (name) body.set(name, value);
  }
  for (const [field, value] of Object.entries(credentials)) {
    body.set(field, value);
  }

  // Step 3: Resolve form action against the final URL (after redirects), not the original.
  const action = form.getAttribute("action") || "";
  const formActionUrl = new URL(action, loginFinalUrl).href;

  // Step 4: Auto-detect CSRF cookies and include as headers (double-submit pattern).
  const csrfHeaders = jar.csrfHeaders();
  console.log(
    `[http-login] POST ${formActionUrl} (fields: ${[...body.keys()].join(", ")})`,
  );

  const result = await httpFetch(formActionUrl, {
    method: "POST",
    body: body.toString(),
    contentType: "application/x-www-form-urlencoded",
    extraHeaders: csrfHeaders,
    jar,
    userAgent,
  });
  console.log(
    `[http-login] POST → ${result.status} (final: ${result.finalUrl}, ${result.html.length} bytes)`,
  );
  return result;
}
