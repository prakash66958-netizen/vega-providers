import { ProviderContext } from "../types";

export const DEFAULT_BASE_URL = "https://animepahe.pw";

export async function getBaseUrl(providerContext: ProviderContext): Promise<string> {
  const custom = await providerContext?.kvStore?.get<string>("baseUrlOverride");
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/+$/, "");
  }
  return DEFAULT_BASE_URL;
}

export async function getAnimePaheHeaders(
  providerContext: ProviderContext,
  baseUrl: string,
): Promise<Record<string, string>> {
  const kvStore = providerContext?.kvStore;
  const userAgent =
    (await kvStore?.get<string>("animepahe_ua")) ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
  const cookie = (await kvStore?.get<string>("animepahe_cookie")) || "";

  const headers: Record<string, string> = {
    "User-Agent": userAgent,
    Accept: "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: `${baseUrl}/`,
    "X-Requested-With": "XMLHttpRequest",
  };

  if (cookie) {
    headers["Cookie"] = cookie;
  }

  return headers;
}

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
  const { axios, openWebView, kvStore } = providerContext;
  const baseUrl = await getBaseUrl(providerContext);

  let targetUrl = endpointOrUrl;
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    const slash = targetUrl.startsWith("/") ? "" : "/";
    targetUrl = `${baseUrl}${slash}${targetUrl}`;
  }

  const headers = await getAnimePaheHeaders(providerContext, baseUrl);
  if (options.isHtml) {
    headers["Accept"] =
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";
  }

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
    // Check if Cloudflare WAF or Anti-bot blocked the request (403 Forbidden / 503 Service Unavailable)
    if (
      (error.response?.status === 403 || error.response?.status === 503) &&
      openWebView
    ) {
      console.log(
        `AnimePahe: WAF challenge (Status ${error.response?.status}) detected for ${targetUrl}. Opening solver...`,
      );

      const cleanHeaders = { ...headers, Referer: baseUrl };
      delete cleanHeaders["User-Agent"];
      delete cleanHeaders["Cookie"];

      const wafResult = await openWebView(baseUrl, {
        title: "AnimePahe Verification",
        description: "Please solve the Cloudflare verification to enable streaming.",
        headers: cleanHeaders,
        waitForCookie: "cf_clearance",
        force: true,
      });

      if (wafResult.userAgent) {
        headers["User-Agent"] = wafResult.userAgent;
        await kvStore?.set("animepahe_ua", wafResult.userAgent);
      }
      if (wafResult.cookies) {
        headers["Cookie"] = wafResult.cookies;
        await kvStore?.set("animepahe_cookie", wafResult.cookies);
      }

      // Retry request with solved clearance
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
