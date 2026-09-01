import { ProviderContext, Stream } from "../types";
import { kwikExtractor } from "../extractors/kwik";
import { getBaseUrl, requestAnimePahe } from "./client";

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
    const playUrl = link.startsWith("http")
      ? link
      : `${baseUrl}${link.startsWith("/") ? "" : "/"}${link}`;

    const response = await requestAnimePahe(playUrl, providerContext, {
      isHtml: true,
      signal,
    });
    const html = response.data;
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

    // Find all resolution/download buttons on the play page
    $("button[data-src], #resolutionMenu button, #dropDownload a, div#pickDownload a").each(
      (_, el) => {
        const kwikUrl = $(el).attr("data-src") || $(el).attr("href") || "";
        if (!kwikUrl || (!kwikUrl.includes("kwik") && !kwikUrl.includes("/e/"))) {
          return;
        }

        // Avoid duplicate candidates
        if (candidates.some((c) => c.kwikUrl === kwikUrl)) {
          return;
        }

        const audioCode = $(el).attr("data-audio") || "";
        const audioLabel =
          audioCode === "eng" || audioCode.toLowerCase().includes("dub")
            ? "Dub"
            : "Sub";

        const resolution = $(el).attr("data-resolution") || "720";
        const fansub = $(el).attr("data-fansub") || "";
        const textLabel = $(el).text().trim();

        const fansubPart = fansub ? ` - ${fansub}` : "";
        const label =
          textLabel || `Kwik ${resolution}p (${audioLabel}${fansubPart})`;

        candidates.push({
          label,
          kwikUrl,
          resolution,
          audio: audioLabel.toLowerCase(),
          fansub,
        });
      },
    );

    const streams: Stream[] = [];

    // Resolve candidates concurrently
    const extractionPromises = candidates.map(async (candidate) => {
      try {
        const extracted = await kwikExtractor(
          candidate.kwikUrl,
          axios,
          signal,
          playUrl,
        );

        if (extracted?.streamUrl) {
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
            link: extracted.streamUrl,
            type: extracted.type || "m3u8",
            quality: qualityVal,
            headers: {
              Referer: candidate.kwikUrl,
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
            },
            _audio: candidate.audio,
            _res: candidate.resolution,
          };
        }
      } catch (err) {
        console.error("AnimePahe failed resolving candidate:", candidate.label, err);
      }
      return null;
    });

    const results = await Promise.all(extractionPromises);

    for (const res of results) {
      if (res) {
        const { _audio, _res, ...streamItem } = res;
        streams.push(streamItem);
      }
    }

    // Sort streams based on user preference and download mode
    streams.sort((a, b) => {
      // 1. If preferredAudio matches
      if (preferredAudio === "sub") {
        if (a.server.includes("Sub") && !b.server.includes("Sub")) return -1;
        if (!a.server.includes("Sub") && b.server.includes("Sub")) return 1;
      } else if (preferredAudio === "dub") {
        if (a.server.includes("Dub") && !b.server.includes("Dub")) return -1;
        if (!a.server.includes("Dub") && b.server.includes("Dub")) return 1;
      }

      // 2. Resolution matching
      if (preferredQuality !== "auto") {
        if (a.quality === preferredQuality && b.quality !== preferredQuality)
          return -1;
        if (a.quality !== preferredQuality && b.quality === preferredQuality)
          return 1;
      }

      // 3. If download mode, prefer 1080p -> 720p -> 480p -> 360p
      const qA = parseInt(a.quality || "0", 10);
      const qB = parseInt(b.quality || "0", 10);
      return qB - qA;
    });

    return streams;
  } catch (error) {
    console.error("AnimePahe getStream error:", error);
    return [];
  }
};
