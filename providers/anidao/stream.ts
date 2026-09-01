import { ProviderContext, Stream } from "../types";
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

async function buildStreamsFromMaster(
  masterUrl: string,
  axios: any,
): Promise<Stream[]> {
  const streams: Stream[] = [];

  // 1. Primary Master Playlist (Auto / Adaptive HLS for ExoPlayer & AVPlayer)
  streams.push({
    server: "AniDao (Auto / 1080p)",
    link: masterUrl,
    type: "m3u8",
    quality: "1080",
  });

  // 2. Parse child playlists
  try {
    const res = await axios.get(masterUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
      },
    });

    const body = typeof res.data === "string" ? res.data : "";
    if (body.includes("#EXTM3U")) {
      const lines = body.split("\n");
      const childQualities: { quality: "1080" | "720" | "480" | "360"; link: string }[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("#EXT-X-STREAM-INF:")) {
          const nextLine = lines[i + 1] ? lines[i + 1].trim() : "";
          if (nextLine && !nextLine.startsWith("#")) {
            const fullUrl = new URL(nextLine, masterUrl).href;
            let q: "1080" | "720" | "480" | "360" = "1080";
            if (line.includes("1920x1080") || line.includes('1080p"') || line.includes("1080")) {
              q = "1080";
            } else if (line.includes("1280x720") || line.includes('720p"') || line.includes("720")) {
              q = "720";
            } else if (line.includes("854x480") || line.includes("852x480") || line.includes('480p"') || line.includes("480")) {
              q = "480";
            } else if (line.includes("640x360") || line.includes('360p"') || line.includes("360")) {
              q = "360";
            }

            if (!childQualities.some((c) => c.link === fullUrl)) {
              childQualities.push({ quality: q, link: fullUrl });
            }
          }
        }
      }

      // Sort descending (1080p, 720p, 480p, 360p)
      const rank: Record<string, number> = { "1080": 1, "720": 2, "480": 3, "360": 4 };
      childQualities.sort((a, b) => (rank[a.quality] || 9) - (rank[b.quality] || 9));

      for (const cq of childQualities) {
        streams.push({
          server: `AniDao ${cq.quality}p`,
          link: cq.link,
          type: "m3u8",
          quality: cq.quality,
        });
      }
    }
  } catch {}

  return streams;
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
          const parsed = await buildStreamsFromMaster(streamUrl, axios);
          for (const s of parsed) {
            if (!streams.some((existing) => existing.link === s.link)) {
              streams.push(s);
            }
          }
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

                  const parsed = await buildStreamsFromMaster(resolvedUrl, axios);
                  for (const s of parsed) {
                    if (!streams.some((existing) => existing.link === s.link)) {
                      streams.push(s);
                    }
                  }
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
