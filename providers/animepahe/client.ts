import { ProviderContext } from "../types";

export const DEFAULT_BASE_URL = "https://animepahe.pw";

export async function getBaseUrl(providerContext?: ProviderContext): Promise<string> {
  const custom = await providerContext?.kvStore?.get<string>("baseUrlOverride");
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/+$/, "");
  }
  return DEFAULT_BASE_URL;
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
    "User-Agent":
      savedUa ||
      commonHeaders?.["User-Agent"] ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    Accept: options.isHtml
      ? "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
      : "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: `${baseUrl}/`,
  };

  if (!options.isHtml) {
    headers["X-Requested-With"] = "XMLHttpRequest";
  }

  if (savedCookie) {
    headers["Cookie"] = savedCookie;
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
    // If Cloudflare WAF 403 is encountered and openWebView solver is available
    if (
      (error.response?.status === 403 || error.response?.status === 503) &&
      openWebView
    ) {
      console.log(
        `AnimePahe: Cloudflare challenge (Status ${error.response?.status}) for ${targetUrl}. Opening solver...`,
      );

      const wafResult = await openWebView(baseUrl, {
        title: "Solve the captcha below and click done",
        description: "Required to bypass AnimePahe Cloudflare protection.",
        headers: {
          ...headers,
          Referer: baseUrl,
        },
        force: true,
        waitForCookie: "cf_clearance",
      });

      const newCookie = wafResult.cookies;
      const newUa = wafResult.userAgent;

      if (newUa) {
        await kvStore?.set("animepahe_ua", newUa);
        headers["User-Agent"] = newUa;
      }
      if (newCookie) {
        await kvStore?.set("animepahe_cookie", newCookie);
        headers["Cookie"] = newCookie;
      }

      return await axios({
        url: targetUrl,
        method: options.method || "GET",
        data: options.data,
        headers: {
          ...headers,
          Referer: `${baseUrl}/`,
          Cookie: newCookie,
          "User-Agent": newUa || headers["User-Agent"],
        },
        signal: options.signal,
      });
    }

    throw error;
  }
}
