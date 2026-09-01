import { ProviderContext } from "../types";

export function unpackJs(packed: string): string {
  try {
    const match = packed.match(
      /eval\(function\(p,a,c,k,e,[rd]\)\s*\{[\s\S]*?\}\s*\((['"][\s\S]*?['"]),\s*(\d+),\s*(\d+),\s*(['"][\s\S]*?['"])\.split\('\|'\)/,
    );
    if (!match) return packed;

    let [, pRaw, aStr, cStr, kRaw] = match;
    let p = pRaw.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
    const a = parseInt(aStr, 10);
    let c = parseInt(cStr, 10);
    const k = kRaw.slice(1, -1).split("|");

    const e = (cNum: number): string => {
      return (
        (cNum < a ? "" : e(Math.floor(cNum / a))) +
        (cNum % a > 35
          ? String.fromCharCode((cNum % a) + 29)
          : (cNum % a).toString(36))
      );
    };

    while (c--) {
      if (k[c]) {
        const reg = new RegExp("\\b" + e(c) + "\\b", "g");
        p = p.replace(reg, () => k[c]);
      }
    }
    return p;
  } catch (err) {
    console.error("unpackJs error:", err);
    return packed;
  }
}

export async function kwikExtractor(
  kwikUrl: string,
  providerContext: ProviderContext,
  signal?: AbortSignal,
  referer: string = "https://animepahe.pw/",
): Promise<{ streamUrl: string; type: string } | null> {
  const { axios, commonHeaders, kvStore } = providerContext;

  const savedUa = await kvStore?.get<string>("animepahe_ua");
  const savedCookie = await kvStore?.get<string>("animepahe_cookie");

  const headers: Record<string, string> = {
    ...(commonHeaders || {}),
    Referer: referer,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };

  if (savedUa) headers["User-Agent"] = savedUa;
  if (savedCookie) headers["Cookie"] = savedCookie;

  try {
    let html = "";
    try {
      const res = await axios.get(kwikUrl, { headers, signal });
      html = typeof res?.data === "string" ? res.data : "";
    } catch {
      // Fallback directly without opening WebView
      return { streamUrl: kwikUrl, type: "embed" };
    }

    if (!html) {
      return { streamUrl: kwikUrl, type: "embed" };
    }

    // Unpack all packed scripts in the HTML
    let unpacked = "";
    const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    for (const match of scriptMatches) {
      const scriptBody = match[1];
      if (scriptBody.includes("eval(function(p,a,c,k,e,")) {
        unpacked += "\n" + unpackJs(scriptBody);
      }
    }

    const searchContext = html + "\n" + unpacked;

    // 1. Look for direct .m3u8 source URL
    const m3u8Match =
      searchContext.match(
        /const\s+source\s*=\s*['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/i,
      ) ||
      searchContext.match(/src\s*:\s*['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/i) ||
      searchContext.match(/file\s*:\s*['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/i) ||
      searchContext.match(/url\s*:\s*['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/i) ||
      searchContext.match(/['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/i);

    if (m3u8Match?.[1]) {
      return { streamUrl: m3u8Match[1], type: "m3u8" };
    }

    // 2. Look for direct .mp4 source URL
    const mp4Match =
      searchContext.match(
        /src\s*:\s*['"](https?:\/\/[^'"]+\.mp4[^'"]*)['"]/i,
      ) ||
      searchContext.match(/file\s*:\s*['"](https?:\/\/[^'"]+\.mp4[^'"]*)['"]/i) ||
      searchContext.match(/['"](https?:\/\/[^'"]+\.mp4[^'"]*)['"]/i);

    if (mp4Match?.[1]) {
      return { streamUrl: mp4Match[1], type: "mp4" };
    }

    // 3. Look for POST form download token in unpacked script
    const formMatch =
      searchContext.match(
        /action=['"](https?:\/\/[^'"]+kwik\.[^'"]+\/d\/[^'"]+)['"][\s\S]*?name=['"]_token['"]\s+value=['"]([^'"]+)['"]/i,
      ) ||
      searchContext.match(
        /action=['"](https?:\/\/[^'"]+\/d\/[^'"]+)['"][\s\S]*?value=['"]([^'"]+)['"]\s+name=['"]_token['"]/i,
      );

    if (formMatch?.[1] && formMatch?.[2]) {
      const formUrl = formMatch[1];
      const token = formMatch[2];

      try {
        const postRes = await axios.post(
          formUrl,
          new URLSearchParams({ _token: token }).toString(),
          {
            headers: {
              ...headers,
              "Content-Type": "application/x-www-form-urlencoded",
              Referer: kwikUrl,
            },
            maxRedirects: 0,
            validateStatus: (status: number) => status >= 200 && status < 400,
            signal,
          },
        );

        const downloadLocation =
          postRes.headers["location"] || postRes.headers["Location"];
        if (downloadLocation) {
          return {
            streamUrl: downloadLocation,
            type: downloadLocation.includes(".m3u8") ? "m3u8" : "mp4",
          };
        }
      } catch {
        // Continue to fallback
      }
    }

    // 4. Broad regex fallback for any .m3u8 or .mp4 URL in searchContext
    const broadM3u8 = searchContext.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
    if (broadM3u8) {
      return { streamUrl: broadM3u8[0], type: "m3u8" };
    }
    const broadMp4 = searchContext.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/i);
    if (broadMp4) {
      return { streamUrl: broadMp4[0], type: "mp4" };
    }

    // 5. Fallback: return kwikUrl as embed
    return { streamUrl: kwikUrl, type: "embed" };
  } catch (error) {
    console.error("kwikExtractor error for", kwikUrl, error);
    return { streamUrl: kwikUrl, type: "embed" };
  }
}
