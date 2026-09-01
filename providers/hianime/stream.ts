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
  const { axios, cheerio, kvStore } = providerContext;
  const baseUrl = await getBaseUrl(providerContext);

  try {
    const preferredAudio =
      (await kvStore?.get<string>("preferredAudio")) || "all";

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
            let origin = "";
            try {
              origin = new URL(candidate.playerUrl).origin;
            } catch {
              origin = "https://zokoanime.video";
            }

            const streamHeaders = {
              Referer: `${origin}/`,
              Origin: origin,
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
            };

            // Extract subtitle tracks
            const subtitles: TextTracks = [];
            if (Array.isArray(decoded.subtitles)) {
              for (const sub of decoded.subtitles) {
                if (sub.src) {
                  subtitles.push({
                    title: sub.label || sub.lang || "English",
                    language: sub.lang || "en",
                    type: "text/vtt",
                    uri: sub.src,
                  });
                }
              }
            }

            // Add master playlist
            streams.push({
              server: `HiAnime ${candidate.serverName} Auto (${typeLabel})`,
              link: masterUrl,
              type: "m3u8",
              quality: "1080",
              subtitles: subtitles.length > 0 ? subtitles : undefined,
              headers: streamHeaders,
            });

            // Parse direct quality streams from the master m3u8
            try {
              const masterRes = await axios.get(masterUrl, {
                headers: streamHeaders,
                signal,
              });
              const lines: string[] = masterRes.data.split("\n");
              const base = masterUrl.substring(0, masterUrl.lastIndexOf("/") + 1);

              for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.includes("RESOLUTION=")) {
                  const resMatch = line.match(/RESOLUTION=\d+x(\d+)/);
                  const qualityVal = resMatch ? resMatch[1] : "1080";
                  const qualityTyped = (
                    qualityVal === "1080"
                      ? "1080"
                      : qualityVal === "720"
                        ? "720"
                        : qualityVal === "480"
                          ? "480"
                          : qualityVal === "360"
                            ? "360"
                            : "720"
                  ) as "360" | "480" | "720" | "1080" | "2160";

                  const childPath = lines[i + 1]?.trim();
                  if (childPath && !childPath.startsWith("#")) {
                    const childUrl = childPath.startsWith("http")
                      ? childPath
                      : new URL(childPath, base).toString();

                    streams.push({
                      server: `HiAnime ${candidate.serverName} ${qualityVal}p (${typeLabel})`,
                      link: childUrl,
                      type: "m3u8",
                      quality: qualityTyped,
                      subtitles: subtitles.length > 0 ? subtitles : undefined,
                      headers: streamHeaders,
                    });
                  }
                }
              }
            } catch (mErr) {
              console.warn("HiAnime failed parsing child qualities:", mErr);
            }
          }
        }
      } catch (err) {
        console.warn("HiAnime server resolve error:", candidate.serverName, err);
      }
    }

    // Sort streams: user audio preferences first (Sub vs Dub), then Direct Quality streams first
    streams.sort((a, b) => {
      if (preferredAudio === "sub") {
        if (a.server.includes("Sub") && !b.server.includes("Sub")) return -1;
        if (!a.server.includes("Sub") && b.server.includes("Sub")) return 1;
      } else if (preferredAudio === "dub") {
        if (a.server.includes("Dub") && !b.server.includes("Dub")) return -1;
        if (!a.server.includes("Dub") && b.server.includes("Dub")) return 1;
      }

      // Prioritize explicit resolution (e.g. 1080p) over Auto
      const aIsAuto = a.server.includes("Auto");
      const bIsAuto = b.server.includes("Auto");
      if (!aIsAuto && bIsAuto) return -1;
      if (aIsAuto && !bIsAuto) return 1;

      const qA = parseInt(a.quality || "0", 10);
      const qB = parseInt(b.quality || "0", 10);
      return qB - qA;
    });

    return streams;
  } catch (error) {
    throwProviderError("HiAnime", "getStream", error);
  }
};
