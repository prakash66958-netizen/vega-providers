import { EpisodeLink, ProviderContext } from "../types";
import { getBaseUrl, makeAniwaveRequest } from "./client";
import { throwProviderError } from "../providerErrors";

export const getEpisodes = async function ({
  url,
  providerContext,
}: {
  url: string;
  providerContext: ProviderContext;
}): Promise<EpisodeLink[]> {
  const { cheerio } = providerContext;
  const baseUrl = await getBaseUrl(providerContext);

  try {
    const targetUrl = url.startsWith("http")
      ? url
      : `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;

    const res = await makeAniwaveRequest(targetUrl, providerContext, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
      allowWebView: false,
    });

    const data = typeof res?.data === "string" ? JSON.parse(res.data) : res?.data;
    const rawHtml: string = data?.result || (typeof data === "string" ? data : "");

    if (!rawHtml) {
      return [];
    }

    const $ = cheerio.load(rawHtml);
    const episodes: EpisodeLink[] = [];

    $("li a[data-ids], a[data-ids]").each((_, el) => {
      const dataIds = $(el).attr("data-ids") || "";
      if (!dataIds) return;

      const num = $(el).attr("data-num") || $(el).find("b").text().trim() || "";
      const epName =
        $(el).find(".d-title, span.d-title, span").first().text().trim() ||
        $(el).attr("title") ||
        "";

      const title = epName && !epName.toLowerCase().startsWith("episode")
        ? `Episode ${num} - ${epName}`
        : `Episode ${num || "1"}`;

      const playLink = `/ajax/server/list?servers=${dataIds}`;

      episodes.push({
        title,
        link: playLink,
        quickDownload: true,
      });
    });

    return episodes;
  } catch (error) {
    throwProviderError("Aniwave", "getEpisodes", error);
  }
};
