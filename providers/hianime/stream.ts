import { ProviderContext, Stream, TextTracks } from "../types";
import { getBaseUrl, getHiAnimeHeaders } from "./client";
import { throwProviderError } from "../providerErrors";

const OBF_KEY = "otaku-embed-v1";

function deobfuscate(blob: string): any {
  try {
    const binary = atob(blob);
    let xorOut = "";
    for (let i = 0; i < binary.length; i++) {
      xorOut += String.fromCharCode(
        binary.charCodeAt(i) ^ OBF_KEY.charCodeAt(i % OBF_KEY.length),
      );
    }
    return JSON.parse(decodeURIComponent(escape(xorOut)));
  } catch (err) {
    console.error("HiAnime deobfuscate error:", err);
    return null;
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
      headers: {
        ...getHiAnimeHeaders(baseUrl),
        "X-Requested-With": "XMLHttpRequest",
      },
      signal,
    });

    const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
    const rawHtml: string = data?.html || (typeof data === "string" ? data : "");

    if (!rawHtml) {
      return [];
    }

    const $ = cheerio.load(rawHtml);
    const serverCandidates: {
      type: "sub" | "dub";
      serverName: string;
      playerUrl: string;
    }[] = [];

    $(".server-item, .item[data-hash]").each((_, el) => {
      const type = ($(el).attr("data-type") || "sub").toLowerCase() as "sub" | "dub";
      const serverName = $(el).attr("data-server-name") || $(el).text().trim() || "HD";
      const dataHash = $(el).attr("data-hash") || "";

      if (dataHash) {
        try {
          const playerUrl = atob(dataHash);
          if (playerUrl && playerUrl.startsWith("http")) {
            serverCandidates.push({
              type,
              serverName,
              playerUrl,
            });
          }
        } catch {
          // ignore invalid hash
        }
      }
    });

    const streams: Stream[] = [];

    for (const candidate of serverCandidates) {
      try {
        const playerRes = await axios.get(candidate.playerUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
            Referer: `${baseUrl}/`,
          },
          signal,
        });

        const playerHtml: string =
          typeof playerRes.data === "string" ? playerRes.data : "";

        // Extract window.__P = "..."
        const pMatch = playerHtml.match(/window\.__P\s*=\s*["']([^"']+)["']/);
        if (pMatch && pMatch[1]) {
          const decoded = deobfuscate(pMatch[1]);
          if (decoded && decoded.src) {
            const masterUrl: string = decoded.src;
            const typeLabel = candidate.type === "dub" ? "Dub" : "Sub";
            const serverTitle = `HiAnime ${candidate.serverName} (${typeLabel})`;

            // Extract subtitle tracks
            const subtitles: TextTracks = [];
            if (Array.isArray(decoded.subtitles)) {
              for (const sub of decoded.subtitles) {
                if (sub.src) {
                  subtitles.push({
                    title: sub.label || sub.lang || "Subtitle",
                    language: sub.lang || "en",
                    type: "application/x-subrip",
                    uri: sub.src,
                  });
                }
              }
            }

            let origin = "";
            try {
              origin = new URL(candidate.playerUrl).origin;
            } catch {
              origin = "https://zokoanime.video";
            }

            streams.push({
              server: serverTitle,
              link: masterUrl,
              type: "m3u8",
              quality: "1080",
              subtitles: subtitles.length > 0 ? subtitles : undefined,
              headers: {
                Referer: candidate.playerUrl,
                Origin: origin,
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
              },
            });
          }
        }
      } catch (err) {
        console.warn("HiAnime server resolve error:", candidate.serverName, err);
      }
    }

    return streams;
  } catch (error) {
    throwProviderError("HiAnime", "getStream", error);
  }
};
