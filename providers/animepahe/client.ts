import { ProviderContext } from "../types";

export const DEFAULT_BASE_URL = "https://animepahe.pw";

let isSolvingWaf = false;
let lastSolvedAt = 0;

export async function getBaseUrl(
  providerContext?: ProviderContext,
): Promise<string> {
  const custom = await providerContext?.kvStore?.get<string>("baseUrlOverride");
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/+$/, "");
  }
  return DEFAULT_BASE_URL;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extracts JSON or clean HTML payload from a WebView outerHTML response.
 */
function extractDataFromWaf(rawData: string): any {
  if (!rawData || typeof rawData !== "string") {
    return rawData;
  }

  const trimmed = rawData.trim();

  // 1. Check for JSON inside <pre> tag (standard browser display for JSON endpoints)
  const preMatch = trimmed.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  if (preMatch && preMatch[1]) {
    try {
      return JSON.parse(preMatch[1].trim());
    } catch {
      // Continue
    }
  }

  // 2. Check for JSON inside <body> tag
  const bodyMatch = trimmed.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch && bodyMatch[1]) {
    const bodyContent = bodyMatch[1].trim();
    if (bodyContent.startsWith("{") || bodyContent.startsWith("[")) {
      try {
        return JSON.parse(bodyContent);
      } catch {
        // Not JSON
      }
    }
  }

  // 3. Check if raw data is direct JSON string
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Continue
    }
  }

  return rawData;
}

/**
 * Unified request handler:
 * - Prevents multiple WebViews from opening simultaneously or spamming the user.
 * - Caches and reuses cookies & User-Agent in kvStore.
 * - Never opens WebViews on sub-calls or background pagination.
 */
export async function requestAnimePahe(
  endpointOrUrl: string,
  providerContext: ProviderContext,
  options: {
    method?: string;
    data?: any;
    signal?: AbortSignal;
    isHtml?: boolean;
    allowWebView?: boolean;
  } = {},
): Promise<any> {
  const { axios, openWebView, kvStore, commonHeaders } = providerContext;
  const baseUrl = await getBaseUrl(providerContext);

  let targetUrl = endpointOrUrl;
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    const slash = targetUrl.startsWith("/") ? "" : "/";
    targetUrl = `${baseUrl}${slash}${targetUrl}`;
  }

  const savedUa = await kvStore?.get<string>("animepahe_ua");
  const savedCookie = await kvStore?.get<string>("animepahe_cookie");

  const headers: Record<string, string> = {
    ...(commonHeaders || {}),
    Referer: `${baseUrl}/`,
    Accept: options.isHtml
      ? "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
      : "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
  };

  if (savedUa) {
    headers["User-Agent"] = savedUa;
  }
  if (savedCookie) {
    headers["Cookie"] = savedCookie;
  }

  const MAX_RETRIES = 2;
  const BACKOFF_MS = [1500, 3000];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios({
        url: targetUrl,
        method: options.method || "GET",
        data: options.data,
        headers,
        signal: options.signal,
      });
      return response;
    } catch (error: any) {
      const status = error.response?.status;

      // Rate limit (429) backoff
      if (status === 429 && attempt < MAX_RETRIES) {
        const waitMs = BACKOFF_MS[attempt] || 3000;
        console.log(`AnimePahe: 429 rate limit. Backing off ${waitMs}ms...`);
        await sleep(waitMs);
        continue;
      }

      // Cloudflare WAF (403/503): Open solver ONLY if allowWebView is enabled and not already solving
      if (
        (status === 403 || status === 503) &&
        openWebView &&
        options.allowWebView !== false &&
        !isSolvingWaf &&
        Date.now() - lastSolvedAt > 15000
      ) {
        isSolvingWaf = true;
        try {
          console.log(`AnimePahe: Solving Cloudflare verification on ${baseUrl}...`);

          const cleanHeaders: Record<string, string> = {
            Referer: `${baseUrl}/`,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          };

          const wafResult = await openWebView(baseUrl, {
            title: "AnimePahe Verification",
            description: "Please solve the security verification once to continue.",
            headers: cleanHeaders,
            waitForCookie: "cf_clearance",
            force: true,
          });

          lastSolvedAt = Date.now();

          let newCookie = wafResult.cookies || (wafResult as any).cookie || "";
          if (!newCookie && wafResult.cookieMap) {
            newCookie = Object.entries(wafResult.cookieMap)
              .map(([k, v]) => `${k}=${v}`)
              .join("; ");
          }

          const newUa = wafResult.userAgent || savedUa;

          if (newCookie) {
            await kvStore?.set("animepahe_cookie", newCookie);
            headers["Cookie"] = newCookie;
          }
          if (newUa) {
            await kvStore?.set("animepahe_ua", newUa);
            headers["User-Agent"] = newUa;
          }

          // If the solved target was the homepage itself, return data
          if (targetUrl === baseUrl && wafResult.data) {
            return {
              data: wafResult.data,
              status: 200,
              headers: {},
            };
          }

          // Retry the actual target request with the newly saved credentials
          return await axios({
            url: targetUrl,
            method: options.method || "GET",
            data: options.data,
            headers,
            signal: options.signal,
          });
        } catch (wafErr) {
          console.error("AnimePahe: WebView verification failed or cancelled:", wafErr);
        } finally {
          isSolvingWaf = false;
        }
      }

      throw error;
    }
  }
}
