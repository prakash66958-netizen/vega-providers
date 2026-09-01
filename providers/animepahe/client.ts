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
 * Ensure we have valid Cloudflare cookies ONCE.
 * If already solved recently (within 10 min), skip.
 * Called at the start of each module's entry point.
 */
export async function ensureCfClearance(
  providerContext: ProviderContext,
): Promise<void> {
  const { axios, openWebView, kvStore, commonHeaders } = providerContext;
  const baseUrl = await getBaseUrl(providerContext);

  // Check if we already have a recent solve
  const solvedAt = await kvStore?.get<number>("animepahe_solved_at");
  if (solvedAt && Date.now() - solvedAt < 10 * 60 * 1000) {
    // Solved within last 10 minutes — cookies should still be valid
    return;
  }

  // Try a lightweight request to see if we already have access
  const savedUa = await kvStore?.get<string>("animepahe_ua");
  const savedCookie = await kvStore?.get<string>("animepahe_cookie");

  const headers: Record<string, string> = {
    ...(commonHeaders || {}),
    Referer: `${baseUrl}/`,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };

  if (savedUa) headers["User-Agent"] = savedUa;
  if (savedCookie) headers["Cookie"] = savedCookie;

  try {
    await axios({ url: baseUrl, method: "GET", headers });
    // Success — mark as solved so we don't recheck
    await kvStore?.set("animepahe_solved_at", Date.now());
    return;
  } catch (err: any) {
    const status = err.response?.status;
    if (status !== 403 && status !== 503) {
      // Some other error (network, 5xx, etc.), skip WAF solve
      return;
    }
  }

  // We need to solve Cloudflare
  if (!openWebView) return;

  console.log("AnimePahe: Solving Cloudflare challenge via WebView...");

  const cleanHeaders: Record<string, string> = { Referer: baseUrl };
  const wafResult = await openWebView(baseUrl, {
    title: "Solve the captcha below and click done",
    description: "Required to access AnimePahe.",
    headers: cleanHeaders,
    force: true,
    waitForCookie: "cf_clearance",
  });

  // Extract ALL cookies
  let newCookie = wafResult.cookies || (wafResult as any).cookie || "";
  if (!newCookie && wafResult.cookieMap) {
    newCookie = Object.entries(wafResult.cookieMap)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  const newUa = wafResult.userAgent || savedUa;

  if (newUa) {
    await kvStore?.set("animepahe_ua", newUa);
  }
  if (newCookie) {
    await kvStore?.set("animepahe_cookie", newCookie);
  }
  await kvStore?.set("animepahe_solved_at", Date.now());

  console.log("AnimePahe: Cloudflare solved. Cookies cached.");
}

/**
 * Core request function.
 *
 * Key design:
 * - Does NOT open WebView. WebView is only opened once via ensureCfClearance().
 * - On 429: retries with long exponential backoff (3s → 8s → 15s).
 * - On 403: clears cached cookies so the NEXT call to ensureCfClearance() re-solves.
 * - On 429 after max retries: throws so the app shows a clean error.
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
  const { axios, kvStore, commonHeaders } = providerContext;
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

  const MAX_RETRIES = 3;
  // Backoff: 3s → 8s → 15s (much more conservative than before)
  const BACKOFF_MS = [3000, 8000, 15000];

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

      // 429: Rate limited — wait longer
      if (status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = error.response?.headers?.["retry-after"];
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : BACKOFF_MS[attempt] || 15000;
        console.log(
          `AnimePahe: 429 rate limited. Waiting ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
        );
        await sleep(waitMs);
        continue;
      }

      // 403/503: Cloudflare rejected — clear cached cookies so ensureCfClearance re-solves next time
      if (status === 403 || status === 503) {
        console.warn(
          `AnimePahe: Got ${status} for ${targetUrl}. Clearing cached cookies.`,
        );
        await kvStore?.delete("animepahe_solved_at");
        await kvStore?.delete("animepahe_cookie");
        await kvStore?.delete("animepahe_ua");
      }

      throw error;
    }
  }
}
