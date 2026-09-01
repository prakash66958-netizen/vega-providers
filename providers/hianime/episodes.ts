import { EpisodeLink, ProviderContext } from "../types";
import { getBaseUrl, getHiAnimeHeaders } from "./client";
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
      headers: {
        ...getHiAnimeHeaders(baseUrl),
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
    const rawHtml: string = data?.html || (typeof data === "string" ? data : "");

    if (!rawHtml) {
      return [];
    }

    const $ = cheerio.load(rawHtml);
    const episodes: EpisodeLink[] = [];

    $(".ep-item, a.ssl-item, a[data-id]").each((_, el) => {
      const epId = $(el).attr("data-id") || "";
      if (!epId) return;

      const epNum = $(el).attr("data-number") || $(el).find(".ssli-order").text().trim() || "";
      const epName =
        $(el).find(".ep-name, .dynamic-name").first().text().trim() ||
        $(el).attr("title") ||
        `Episode ${epNum}`;

      const title = epName.toLowerCase().startsWith("episode")
        ? epName
        : `Episode ${epNum}${epName ? ` - ${epName}` : ""}`;

      const playLink = `/api/theme/episode/servers?episodeId=${epId}`;

      episodes.push({
        title,
        link: playLink,
        quickDownload: true,
      });
    });

    return episodes;
  } catch (error) {
    throwProviderError("HiAnime", "getEpisodes", error);
  }
};
