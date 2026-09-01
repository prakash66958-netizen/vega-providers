import { ProviderContext } from "../types";

export const DEFAULT_BASE_URL = "https://animepahe.pw";

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
 * Core request function — follows the same proven pattern as zcloud.ts:
 *
 * 1. Make the request with commonHeaders
 * 2. If 403 → open WebView → put cookies directly into headers → retry ONCE
 * 3. If 429 → exponential backoff retry
 *
 * No pre-flight checks, no kvStore cookie management, no ensureCfClearance.
 * Cookies flow directly from WebView result → retry headers in the same call.
 */
export async function requestAnimePahe(
  endpointOrUrl: string,
  providerContext: ProviderContext,
  options: {
    method?: string;
    data?: any;
    signal?: AbortSignal;
    isHtml?: boolean;
  } = {},
): Promise<any> {
  const { axios, openWebView, commonHeaders } = providerContext;
  const baseUrl = await getBaseUrl(providerContext);

  let targetUrl = endpointOrUrl;
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    const slash = targetUrl.startsWith("/") ? "" : "/";
    targetUrl = `${baseUrl}${slash}${targetUrl}`;
  }

  // Start with commonHeaders only — let the Vega app's injected headers do their job
  const headers: Record<string, string> = {
    ...(commonHeaders || {}),
    Referer: `${baseUrl}/`,
    Accept: options.isHtml
      ? "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
      : "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
  };

  const MAX_429_RETRIES = 3;
  const BACKOFF_MS = [3000, 8000, 15000];

  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
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

      // --- Handle 403/503 Cloudflare WAF (exactly like zcloud.ts) ---
      if ((status === 403 || status === 503) && openWebView) {
        console.log(
          `AnimePahe: WAF detected (${status}) for ${targetUrl}, using solver...`,
        );

        // Clean headers before passing to WebView (same as zcloud)
        const cleanHeaders = { ...headers, Referer: baseUrl };
        delete cleanHeaders["User-Agent"];
        delete cleanHeaders["sec-ch-ua"];
        delete cleanHeaders["sec-ch-ua-mobile"];
        delete cleanHeaders["sec-ch-ua-platform"];
        delete cleanHeaders["Cookie"];

        const wafResult = await openWebView(baseUrl, {
          title: "Solve the captcha below and click done",
          description: "Required to bypass AnimePahe Cloudflare protection.",
          headers: cleanHeaders,
          waitForCookie: "cf_clearance",
          force: true,
        });

        // Forward cookies directly into headers (same pattern as zcloud)
        if (wafResult.userAgent) headers["User-Agent"] = wafResult.userAgent;
        headers["Cookie"] =
          (headers["Cookie"] ? headers["Cookie"] + "; " : "") +
          wafResult.cookies;

        // Retry once with the WebView cookies
        return await axios({
          url: targetUrl,
          method: options.method || "GET",
          data: options.data,
          headers,
          signal: options.signal,
        });
      }

      // --- Handle 429 rate limiting ---
      if (status === 429 && attempt < MAX_429_RETRIES) {
        const retryAfter = error.response?.headers?.["retry-after"];
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : BACKOFF_MS[attempt] || 15000;
        console.log(
          `AnimePahe: 429 rate limited. Waiting ${waitMs}ms (attempt ${attempt + 1}/${MAX_429_RETRIES})`,
        );
        await sleep(waitMs);
        continue;
      }

      throw error;
    }
  }
}
