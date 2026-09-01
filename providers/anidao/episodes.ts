import { EpisodeLink, ProviderContext } from "../types";
import { getBaseUrl, getAniDaoHeaders } from "./client";
import { throwProviderError } from "../providerErrors";

export const getEpisodes = async function ({
  url,
  providerContext,
}: {
  url: string;
  providerContext: ProviderContext;
}): Promise<EpisodeLink[]> {
  const { axios, cheerio } = providerContext;
  const baseUrl = await getBaseUrl(providerContext);

  try {
    const targetUrl = url.startsWith("http")
      ? url
      : `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;

    const res = await axios.get(targetUrl, {
      headers: getAniDaoHeaders(baseUrl),
    });

    const html = typeof res.data === "string" ? res.data : "";
    const $ = cheerio.load(html);
    const episodeMap = new Map<number, EpisodeLink>();

    $("a[href*='/watch-online/']").each((_, a) => {
      const href = $(a).attr("href");
      if (!href) return;

      const numMatch = href.match(/-episode-(\d+)(?:\?|$|\/)/i);
      const textMatch = $(a).text().trim().match(/(\d+)/);
      const epNum = numMatch ? parseInt(numMatch[1], 10) : textMatch ? parseInt(textMatch[1], 10) : 0;

      if (epNum > 0 && !episodeMap.has(epNum)) {
        const link = href.startsWith("http") ? new URL(href).pathname : href;
        episodeMap.set(epNum, {
          title: `Episode ${epNum}`,
          link,
          quickDownload: true,
        });
      }
    });

    // If no numbered episodes found, fallback to all links
    if (episodeMap.size === 0) {
      const episodes: EpisodeLink[] = [];
      $("a[href*='/watch-online/']").each((_, a) => {
        const href = $(a).attr("href");
        const title = $(a).text().trim() || "Episode 1";
        if (href && !episodes.some((e) => e.link === href)) {
          const link = href.startsWith("http") ? new URL(href).pathname : href;
          episodes.push({
            title,
            link,
            quickDownload: true,
          });
        }
      });
      return episodes;
    }

    // Sort ascending
    const sorted = Array.from(episodeMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map((entry) => entry[1]);

    return sorted;
  } catch (error) {
    throwProviderError("AniDao", "getEpisodes", error);
  }
};
