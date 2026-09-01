import { ProviderContext } from "../types";

export const DEFAULT_BASE_URL = "https://aniwaves.ru";

let isSolvingWaf = false;
let wafSolvedUntil = 0;

export async function getBaseUrl(
  providerContext?: ProviderContext,
): Promise<string> {
  const custom = await providerContext?.kvStore?.get<string>("baseUrlOverride");
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/+$/, "");
  }
  return DEFAULT_BASE_URL;
}

export function getAniwaveHeaders(baseUrl: string = DEFAULT_BASE_URL): Record<string, string> {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: `${baseUrl}/`,
  };
}

export async function makeAniwaveRequest(
  url: string,
  providerContext: ProviderContext,
  options: {
    headers?: Record<string, string>;
    signal?: AbortSignal;
    allowWebView?: boolean;
  } = {},
): Promise<any> {
  const { axios, kvStore, openWebView } = providerContext;
  const baseUrl = await getBaseUrl(providerContext);

  const storedCookie = (await kvStore?.get<string>("aniwave_cf_cookie")) || "";
  const storedUa = (await kvStore?.get<string>("aniwave_user_agent")) || "";

  const headers: Record<string, string> = {
    ...getAniwaveHeaders(baseUrl),
    ...(options.headers || {}),
  };

  if (storedUa) {
    headers["User-Agent"] = storedUa;
  }
  if (storedCookie) {
    headers["Cookie"] = storedCookie;
  }

  try {
    const res = await axios.get(url, {
      headers,
      signal: options.signal,
    });
    return res;
  } catch (error: any) {
    const status = error?.response?.status;
    const isWaf = status === 403 || status === 429;

    const now = Date.now();
    const canAttemptSolve =
      isWaf &&
      options.allowWebView !== false &&
      !!openWebView &&
      !isSolvingWaf &&
      now > wafSolvedUntil;

    if (canAttemptSolve) {
      isSolvingWaf = true;
      try {
        const wafResult = await openWebView(baseUrl, {
          title: "Aniwave Verification",
          description: "Please solve the Cloudflare verification to continue",
          headers: getAniwaveHeaders(baseUrl),
          waitForCookie: "cf_clearance",
          force: true,
        });

        isSolvingWaf = false;
        wafSolvedUntil = Date.now() + 15000;

        if (wafResult) {
          const cookies =
            typeof wafResult === "string" ? wafResult : wafResult.cookies || "";
          const userAgent =
            typeof wafResult === "object" ? wafResult.userAgent || "" : "";

          if (cookies) {
            await kvStore?.set("aniwave_cf_cookie", cookies);
            headers["Cookie"] = cookies;
          }
          if (userAgent) {
            await kvStore?.set("aniwave_user_agent", userAgent);
            headers["User-Agent"] = userAgent;
          }

          return await axios.get(url, {
            headers,
            signal: options.signal,
          });
        }
      } catch (solveErr) {
        isSolvingWaf = false;
        console.warn("Aniwave WAF solve error:", solveErr);
      }
    }

    throw error;
  }
}
