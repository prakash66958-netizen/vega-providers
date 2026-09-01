import { EpisodeLink, ProviderContext } from "../types";
import { requestAnimePahe } from "./client";

export const getEpisodes = async function ({
  url,
  providerContext,
}: {
  url: string;
  providerContext: ProviderContext;
}): Promise<EpisodeLink[]> {
  try {
    // Extract anime session ID from the URL parameters
    const urlObj = new URL(
      url.startsWith("http") ? url : `https://animepahe.pw${url.startsWith("/") ? "" : "/"}${url}`,
    );
    const session = urlObj.searchParams.get("id") || "";

    if (!session) {
      console.error("AnimePahe getEpisodes: Missing anime session ID in url:", url);
      return [];
    }

    // Fetch Page 1 of episodes
    const page1Url = `/api?m=release&id=${session}&sort=episode_asc&page=1`;
    const res1 = await requestAnimePahe(page1Url, providerContext);
    const data1 = res1.data;

    if (!data1 || !Array.isArray(data1.data)) {
      return [];
    }

    let allReleases = [...data1.data];
    const lastPage = data1.last_page || 1;

    // Fetch remaining pages in parallel if more than 1 page exists
    if (lastPage > 1) {
      const pagePromises: Promise<any>[] = [];
      for (let p = 2; p <= lastPage; p++) {
        pagePromises.push(
          requestAnimePahe(
            `/api?m=release&id=${session}&sort=episode_asc&page=${p}`,
            providerContext,
          ).catch((e) => {
            console.error(`AnimePahe: Failed to fetch episodes page ${p}:`, e.message);
            return null;
          }),
        );
      }

      const pageResponses = await Promise.all(pagePromises);
      for (const pageRes of pageResponses) {
        if (pageRes?.data?.data && Array.isArray(pageRes.data.data)) {
          allReleases.push(...pageRes.data.data);
        }
      }
    }

    // Sort by episode ascending
    allReleases.sort((a, b) => (Number(a.episode) || 0) - (Number(b.episode) || 0));

    const episodes: EpisodeLink[] = [];
    for (const item of allReleases) {
      const epNum = item.episode ?? "";
      const epTitle = item.title && item.title.trim() ? ` - ${item.title.trim()}` : "";
      const title = `Episode ${epNum}${epTitle}`;
      const playLink = `/play/${session}/${item.session}`;

      const descParts: string[] = [];
      if (item.duration) descParts.push(`Duration: ${item.duration}`);
      if (item.filler === 1) descParts.push("Filler");
      if (item.created_at) descParts.push(item.created_at.split(" ")[0]);

      episodes.push({
        title,
        link: playLink,
        image: item.snapshot || "",
        description: descParts.join(" • "),
        quickDownload: true,
      });
    }

    return episodes;
  } catch (error) {
    console.error("AnimePahe getEpisodes error:", error);
    return [];
  }
};
