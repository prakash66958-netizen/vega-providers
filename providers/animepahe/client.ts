import { ProviderContext } from "../types";

export const DEFAULT_BASE_URL = "https://animepahe.pw";

export async function getBaseUrl(providerContext?: ProviderContext): Promise<string> {
  const custom = await providerContext?.kvStore?.get<string>("baseUrlOverride");
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/+$/, "");
  }
  return DEFAULT_BASE_URL;
}

/**
 * Sleep helper for rate-limit delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Core request function with:
 * - Cloudflare 403/503 WAF solver via openWebView
 * - HTTP 429 retry with exponential backoff (up to 3 retries)
 * - Cookie/UA persistence via kvStore
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

  const MAX_RETRIES = 3;

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

      // Handle 429 Too Many Requests with exponential backoff
      if (status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = error.response?.headers?.["retry-after"];
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : 1500 * Math.pow(2, attempt); // 1.5s, 3s, 6s
        console.log(
          `AnimePahe: Rate limited (429). Retrying in ${waitMs}ms... (attempt ${attempt + 1}/${MAX_RETRIES})`,
        );
        await sleep(waitMs);
        continue;
      }

      // Handle Cloudflare WAF 403/503
      if ((status === 403 || status === 503) && openWebView) {
        console.log(
          `AnimePahe: Cloudflare challenge (${status}) for ${targetUrl}. Opening solver...`,
        );

        const cleanHeaders = { ...headers, Referer: baseUrl };
        delete cleanHeaders["User-Agent"];
        delete cleanHeaders["sec-ch-ua"];
        delete cleanHeaders["sec-ch-ua-mobile"];
        delete cleanHeaders["sec-ch-ua-platform"];
        delete cleanHeaders["Cookie"];

        const wafResult = await openWebView(baseUrl, {
          title: "Solve the captcha below and click done",
          description:
            "Required to bypass AnimePahe Cloudflare protection.",
          headers: cleanHeaders,
          force: true,
          waitForCookie: "cf_clearance",
        });

        let newCookie =
          wafResult.cookies || (wafResult as any).cookie || "";
        if (!newCookie && wafResult.cookieMap) {
          newCookie = Object.entries(wafResult.cookieMap)
            .map(([k, v]) => `${k}=${v}`)
            .join("; ");
        }

        const newUa = wafResult.userAgent || headers["User-Agent"];

        if (newUa) {
          headers["User-Agent"] = newUa;
          await kvStore?.set("animepahe_ua", newUa);
        }
        if (newCookie) {
          headers["Cookie"] =
            (headers["Cookie"] ? headers["Cookie"] + "; " : "") +
            newCookie;
          await kvStore?.set("animepahe_cookie", headers["Cookie"]);
        }

        // Retry the request once after solving WAF
        return await axios({
          url: targetUrl,
          method: options.method || "GET",
          data: options.data,
          headers,
          signal: options.signal,
        });
      }

      throw error;
    }
  }
}
