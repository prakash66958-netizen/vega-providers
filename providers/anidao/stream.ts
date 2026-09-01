import { ProviderContext, Stream, TextTracks } from "../types";
import { getBaseUrl, getAniDaoHeaders } from "./client";
import { throwProviderError } from "../providerErrors";

function unpack(p: string, a: number, c: number, k: string[]) {
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp("\\b" + c.toString(a) + "\\b", "g"), k[c]);
    }
  }
  return p;
}

function safeUnpack(code: string): string {
  try {
    const unpackMatch = code.match(/}\s*\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/);
    if (unpackMatch) {
      const p = unpackMatch[1];
      const a = parseInt(unpackMatch[2], 10);
      const c = parseInt(unpackMatch[3], 10);
      const k = unpackMatch[4].split("|");
      return unpack(p, a, c, k);
    }
    const fn = new Function(`return ${code.replace(/^eval/, "")}`);
    return fn();
  } catch {
    return "";
  }
}

export const getStream = async function ({
  link,
  signal,
  providerContext,
  isDownload,
}: {
  link: string;
  type: string;
  signal?: AbortSignal;
  providerContext: ProviderContext;
  isDownload?: boolean;
}): Promise<Stream[]> {
  const { axios, cheerio } = providerContext;
  const baseUrl = await getBaseUrl(providerContext);

  try {
    const targetUrl = link.startsWith("http")
      ? link
      : `${baseUrl}${link.startsWith("/") ? "" : "/"}${link}`;

    const res = await axios.get(targetUrl, {
      headers: getAniDaoHeaders(baseUrl),
      signal,
    });

    const html = typeof res.data === "string" ? res.data : "";
    const $ = cheerio.load(html);

    const iframes: string[] = [];
    $("iframe").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || "";
      if (src && !iframes.includes(src)) {
        iframes.push(src.startsWith("//") ? `https:${src}` : src);
      }
    });

    $("[data-embed], [data-video], [data-src]").each((_, el) => {
      const s = $(el).attr("data-embed") || $(el).attr("data-video") || $(el).attr("data-src") || "";
      if (s && !iframes.includes(s)) {
        iframes.push(s.startsWith("//") ? `https:${s}` : s);
      }
    });

    if (iframes.length === 0) {
      return [];
    }

    const streams: Stream[] = [];

    for (const iframeUrl of iframes) {
      try {
        let subtitles: TextTracks = [];
        try {
          const urlObj = new URL(iframeUrl);
          const subUrl = urlObj.searchParams.get("sub") || urlObj.searchParams.get("caption_1") || "";
          const subLang = urlObj.searchParams.get("sub_1") || "English";
          if (subUrl) {
            subtitles.push({
              title: subLang,
              language: "en",
              type: "text/vtt",
              uri: subUrl,
            });
          }
        } catch {}

        const embedRes = await axios.get(iframeUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
            Referer: `${baseUrl}/`,
          },
          signal,
        });

        const embedHtml: string = typeof embedRes.data === "string" ? embedRes.data : "";

        // Strategy 1: Direct const src = "..."
        const srcMatch = embedHtml.match(/const\s+src\s*=\s*["']([^"']+)["']/);
        if (srcMatch && srcMatch[1]) {
          const streamUrl = srcMatch[1];

          // 1080p Direct
          if (streamUrl.endsWith("master.m3u8")) {
            const baseFolder = streamUrl.replace(/master\.m3u8.*$/, "");
            streams.push({
              server: "Vibe 1080p (Fast Edge)",
              link: `${baseFolder}1080p/index.m3u8`,
              type: "m3u8",
              quality: "1080",
              subtitles: subtitles.length > 0 ? subtitles : undefined,
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
              },
            });
            streams.push({
              server: "Vibe 720p (Fast Edge)",
              link: `${baseFolder}720p/index.m3u8`,
              type: "m3u8",
              quality: "720",
              subtitles: subtitles.length > 0 ? subtitles : undefined,
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
              },
            });
          }

          // Master Auto playlist
          streams.push({
            server: "Vibe Auto (Adaptive HLS)",
            link: streamUrl,
            type: "m3u8",
            quality: "1080",
            subtitles: subtitles.length > 0 ? subtitles : undefined,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
            },
          });
        }

        // Strategy 2: Packer eval(function(p,a,c,k,e,d)...)
        const packMatch = embedHtml.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?split\('\|'\)\)\)/);
        if (packMatch) {
          const raw = packMatch[0];
          const unpacked = safeUnpack(raw);

          if (unpacked) {
            const linksMatch = unpacked.match(/links\s*=\s*(\{[\s\S]*?\});/);
            if (linksMatch) {
              try {
                const linksObj = JSON.parse(linksMatch[1]);
                const hls2 = linksObj.hls2;
                const hls3 = linksObj.hls3;
                const hls4 = linksObj.hls4;

                const chosen = hls2 || hls4 || hls3;
                if (chosen) {
                  const resolvedUrl = chosen.startsWith("http")
                    ? chosen
                    : `${new URL(iframeUrl).origin}${chosen}`;

                  streams.push({
                    server: "Otaku Stream (1080p)",
                    link: resolvedUrl,
                    type: "m3u8",
                    quality: "1080",
                    subtitles: subtitles.length > 0 ? subtitles : undefined,
                    headers: {
                      "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
                      Referer: `${new URL(iframeUrl).origin}/`,
                    },
                  });
                }
              } catch {}
            }
          }
        }
      } catch (err) {
        console.warn("AniDao stream embed resolution failed:", iframeUrl, err);
      }
    }

    return streams;
  } catch (error) {
    throwProviderError("AniDao", "getStream", error);
  }
};
