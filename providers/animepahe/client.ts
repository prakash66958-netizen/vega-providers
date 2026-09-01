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
      // Not strict JSON, continue
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

  // 4. Return raw string
  return rawData;
}

/**
 * Robust request handler:
 * 1. Checks kvStore for saved Cloudflare cookies & User-Agent.
 * 2. Attempts HTTP request with Axios.
 * 3. On 403 Cloudflare WAF: Opens the targetUrl in the device WebView.
 *    Captures cookies & User-Agent, saves to kvStore.
 *    Returns parsed JSON if already present in WebView, or performs verified Axios request.
 * 4. On 429: Retries with exponential backoff.
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

  const MAX_429_RETRIES = 3;
  const BACKOFF_MS = [2000, 5000, 10000];

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

      // --- Cloudflare WAF (403 / 503) ---
      if ((status === 403 || status === 503) && openWebView) {
        console.log(
          `AnimePahe: Cloudflare challenge (${status}) for ${targetUrl}. Opening WebView solver...`,
        );

        const cleanHeaders: Record<string, string> = {
          Referer: `${baseUrl}/`,
          Accept: headers["Accept"] || "*/*",
        };

        const wafResult = await openWebView(targetUrl, {
          title: "AnimePahe Security Check",
          description: "Please complete the verification once to continue.",
          headers: cleanHeaders,
          waitForCookie: "cf_clearance",
          force: true,
        });

        // Extract cookie string
        let newCookie = wafResult.cookies || (wafResult as any).cookie || "";
        if (!newCookie && wafResult.cookieMap) {
          newCookie = Object.entries(wafResult.cookieMap)
            .map(([k, v]) => `${k}=${v}`)
            .join("; ");
        }

        const newUa = wafResult.userAgent || savedUa;

        // Persist credentials in kvStore so all subsequent calls reuse them
        if (newCookie) {
          await kvStore?.set("animepahe_cookie", newCookie);
          headers["Cookie"] = newCookie;
        }
        if (newUa) {
          await kvStore?.set("animepahe_ua", newUa);
          headers["User-Agent"] = newUa;
        }

        // Check if the WebView returned valid JSON or final non-challenge HTML
        if (wafResult.data && wafResult.data.trim()) {
          const parsed = extractDataFromWaf(wafResult.data);
          const isJsonObject = parsed && typeof parsed === "object";
          const isCfHtml =
            typeof parsed === "string" &&
            (parsed.includes("Just a moment") ||
              parsed.includes("cf-challenge") ||
              parsed.includes("turnstile"));

          if (isJsonObject || (options.isHtml && !isCfHtml)) {
            return {
              data: parsed,
              status: 200,
              headers: {},
            };
          }
        }

        // Retry request with fresh cookies and User-Agent
        try {
          return await axios({
            url: targetUrl,
            method: options.method || "GET",
            data: options.data,
            headers,
            signal: options.signal,
          });
        } catch (retryErr) {
          // If secondary call fails, return whatever data we extracted from the WebView
          if (wafResult.data) {
            return {
              data: extractDataFromWaf(wafResult.data),
              status: 200,
              headers: {},
            };
          }
          throw retryErr;
        }
      }

      // --- Rate Limiting (429) ---
      if (status === 429 && attempt < MAX_429_RETRIES) {
        const retryAfter = error.response?.headers?.["retry-after"];
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : BACKOFF_MS[attempt] || 5000;
        console.log(
          `AnimePahe: Rate limited (429). Retrying in ${waitMs}ms... (attempt ${attempt + 1}/${MAX_429_RETRIES})`,
        );
        await sleep(waitMs);
        continue;
      }

      throw error;
    }
  }
}
