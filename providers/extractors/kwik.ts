export function unpackJs(packed: string): string {
  const match = packed.match(
    /eval\(function\(p,a,c,k,e,[rd]\)\s*\{[\s\S]*?\}\s*\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/,
  );
  if (!match) return packed;

  let [, p, aStr, cStr, kStr] = match;
  const a = parseInt(aStr, 10);
  let c = parseInt(cStr, 10);
  const k = kStr.split("|");

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
      p = p.replace(reg, k[c]);
    }
  }
  return p;
}

export async function kwikExtractor(
  kwikUrl: string,
  axios: any,
  signal?: AbortSignal,
  referer: string = "https://animepahe.pw/",
): Promise<{ streamUrl?: string; type?: string } | null> {
  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
      Referer: referer,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    };

    const res = await axios.get(kwikUrl, { headers, signal });
    const html: string = res.data;

    // Unpack any Dean Edwards packed JavaScript in the HTML
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
    const m3u8Match = searchContext.match(
      /const\s+source\s*=\s*['"](https:\/\/[^'"]+\.m3u8[^'"]*)['"]/i,
    ) || searchContext.match(/['"](https:\/\/[^'"]+\.m3u8[^'"]*)['"]/i);

    if (m3u8Match?.[1]) {
      return {
        streamUrl: m3u8Match[1],
        type: "m3u8",
      };
    }

    // 2. Look for direct .mp4 source URL
    const mp4Match = searchContext.match(
      /['"](https:\/\/[^'"]+\.mp4[^'"]*)['"]/i,
    );
    if (mp4Match?.[1]) {
      return {
        streamUrl: mp4Match[1],
        type: "mp4",
      };
    }

    // 3. Look for POST form token in unpacked script
    const formMatch = searchContext.match(
      /action=['"](https:\/\/[^'"]+kwik\.[^'"]+\/d\/[^'"]+)['"][\s\S]*?name=['"]_token['"]\s+value=['"]([^'"]+)['"]/i,
    ) || searchContext.match(
      /action=['"](https:\/\/[^'"]+\/d\/[^'"]+)['"][\s\S]*?value=['"]([^'"]+)['"]\s+name=['"]_token['"]/i,
    );

    if (formMatch?.[1] && formMatch?.[2]) {
      const formUrl = formMatch[1];
      const token = formMatch[2];

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
    }

    return null;
  } catch (error) {
    console.error("kwikExtractor error:", error);
    return null;
  }
}
