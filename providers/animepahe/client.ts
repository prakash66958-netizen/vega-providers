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
    // If Cloudflare WAF 403 or 503 is encountered and openWebView solver is available
    if (
      (error.response?.status === 403 || error.response?.status === 503) &&
      openWebView
    ) {
      console.log(
        `AnimePahe: Cloudflare challenge (Status ${error.response?.status}) for ${targetUrl}. Opening solver...`,
      );

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
        force: true,
        waitForCookie: "cf_clearance",
      });

      let newCookie = wafResult.cookies || (wafResult as any).cookie || "";
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
          (headers["Cookie"] ? headers["Cookie"] + "; " : "") + newCookie;
        await kvStore?.set("animepahe_cookie", headers["Cookie"]);
      }

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
