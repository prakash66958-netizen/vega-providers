import { ProviderContext, Stream } from "../types";
import { kwikExtractor } from "../extractors/kwik";
import { getBaseUrl, requestAnimePahe } from "./client";
import { throwProviderError } from "../providerErrors";

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
  const { cheerio, axios, kvStore } = providerContext;
  const baseUrl = await getBaseUrl(providerContext);

  try {
    // If the link is already a direct kwik or video link
    if (link.includes("kwik.") || link.includes("/e/") || link.includes("/f/")) {
      const extracted = await kwikExtractor(link, axios, signal, baseUrl);
      return [
        {
          server: "Kwik Stream",
          link: extracted?.streamUrl || link,
          type: extracted?.type || "m3u8",
          quality: "720",
          headers: {
            Referer: link,
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
          },
        },
      ];
    }

    const playUrl = link.startsWith("http")
      ? link
      : `${baseUrl}${link.startsWith("/") ? "" : "/"}${link}`;

    const response = await requestAnimePahe(playUrl, providerContext, {
      isHtml: true,
      signal,
    });
    const html: string = typeof response.data === "string" ? response.data : "";
    const $ = cheerio.load(html);

    // Read user configuration from settings
    const preferredQuality =
      (await kvStore?.get<string>("preferredQuality")) || "auto";
    const preferredAudio =
      (await kvStore?.get<string>("preferredAudio")) || "all";

    interface ServerCandidate {
      label: string;
      kwikUrl: string;
      resolution: string;
      audio: string;
      fansub: string;
    }

    const candidates: ServerCandidate[] = [];

    // Helper to add unique candidate
    const addCandidate = (
      kwikUrl: string,
      resVal: string = "720",
      audioVal: string = "sub",
      fansubVal: string = "",
      customLabel?: string,
    ) => {
      if (!kwikUrl || candidates.some((c) => c.kwikUrl === kwikUrl)) return;

      const audioLabel = audioVal.toLowerCase().includes("dub") ? "Dub" : "Sub";
      const fansubPart = fansubVal ? ` - ${fansubVal}` : "";
      const label =
        customLabel || `Kwik ${resVal}p (${audioLabel}${fansubPart})`;

      candidates.push({
        label,
        kwikUrl,
        resolution: resVal,
        audio: audioLabel.toLowerCase(),
        fansub: fansubVal,
      });
    };

    // 1. Find all resolution and download buttons
    $(
      "button[data-src], #resolutionMenu button, #dropDownload a, div#pickDownload a, a[data-src], a[href*='kwik']",
    ).each((_, el) => {
      const kwikUrl = $(el).attr("data-src") || $(el).attr("href") || "";
      if (!kwikUrl || (!kwikUrl.includes("kwik") && !kwikUrl.includes("/e/") && !kwikUrl.includes("/f/"))) {
        return;
      }

      const audioCode = $(el).attr("data-audio") || "";
      const resolution = $(el).attr("data-resolution") || "720";
      const fansub = $(el).attr("data-fansub") || "";
      const textLabel = $(el).text().trim();

      addCandidate(kwikUrl, resolution, audioCode, fansub, textLabel);
    });

    // 2. Check for iframes
    $("iframe[src]").each((_, el) => {
      const src = $(el).attr("src") || "";
      if (src.includes("kwik") || src.includes("/e/")) {
        addCandidate(src, "720", "sub", "", "Kwik Player (Default)");
      }
    });

    // 3. Regex fallback across full HTML for any kwik embed / download URLs
    const kwikRegex = /https?:\/\/[a-zA-Z0-9.-]*kwik\.[a-z]+\/[ef]\/[a-zA-Z0-9]+/gi;
    let match: RegExpExecArray | null;
    while ((match = kwikRegex.exec(html)) !== null) {
      addCandidate(match[0], "720", "sub", "", "Kwik Stream");
    }

    if (candidates.length === 0) {
      console.warn("AnimePahe: No server candidates found on play page:", playUrl);
      return [];
    }

    // Resolve candidates concurrently
    const extractionPromises = candidates.map(async (candidate) => {
      try {
        const extracted = await kwikExtractor(
          candidate.kwikUrl,
          axios,
          signal,
          playUrl,
        );

        const finalUrl = extracted?.streamUrl || candidate.kwikUrl;
        const qualityVal = (
          candidate.resolution === "1080"
            ? "1080"
            : candidate.resolution === "720"
              ? "720"
              : candidate.resolution === "360"
                ? "360"
                : candidate.resolution === "480"
                  ? "480"
                  : "720"
        ) as "360" | "480" | "720" | "1080" | "2160";

        return {
          server: candidate.label,
          link: finalUrl,
          type: extracted?.type || "m3u8",
          quality: qualityVal,
          headers: {
            Referer: candidate.kwikUrl,
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
          },
          _audio: candidate.audio,
          _res: candidate.resolution,
        };
      } catch (err) {
        console.error(
          "AnimePahe failed resolving candidate:",
          candidate.label,
          err,
        );
        // Even if extraction fails, return candidate with kwikUrl as stream link
        return {
          server: candidate.label,
          link: candidate.kwikUrl,
          type: "m3u8",
          quality: "720" as const,
          headers: {
            Referer: playUrl,
          },
          _audio: candidate.audio,
          _res: candidate.resolution,
        };
      }
    });

    const results = await Promise.all(extractionPromises);
    const streams: Stream[] = [];

    for (const res of results) {
      if (res && res.link) {
        const { _audio, _res, ...streamItem } = res;
        streams.push(streamItem);
      }
    }

    // Sort streams based on preferences
    streams.sort((a, b) => {
      if (preferredAudio === "sub") {
        if (a.server.includes("Sub") && !b.server.includes("Sub")) return -1;
        if (!a.server.includes("Sub") && b.server.includes("Sub")) return 1;
      } else if (preferredAudio === "dub") {
        if (a.server.includes("Dub") && !b.server.includes("Dub")) return -1;
        if (!a.server.includes("Dub") && b.server.includes("Dub")) return 1;
      }

      if (preferredQuality !== "auto") {
        if (a.quality === preferredQuality && b.quality !== preferredQuality)
          return -1;
        if (a.quality !== preferredQuality && b.quality === preferredQuality)
          return 1;
      }

      const qA = parseInt(a.quality || "0", 10);
      const qB = parseInt(b.quality || "0", 10);
      return qB - qA;
    });

    return streams;
  } catch (error) {
    throwProviderError("AnimePahe", "getStream", error);
  }
};
