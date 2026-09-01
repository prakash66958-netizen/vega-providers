import { EpisodeLink, ProviderContext } from "../types";
import { requestAnimePahe } from "./client";
import { throwProviderError } from "../providerErrors";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonSafe(data: any): any {
  if (!data) return null;
  if (typeof data === "object") return data;
  if (typeof data === "string") {
    const trimmed = data.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export const getEpisodes = async function ({
  url,
  providerContext,
}: {
  url: string;
  providerContext: ProviderContext;
}): Promise<EpisodeLink[]> {
  try {
    const urlObj = new URL(
      url.startsWith("http")
        ? url
        : `https://animepahe.pw${url.startsWith("/") ? "" : "/"}${url}`,
    );
    const session = urlObj.searchParams.get("id") || "";

    if (!session) {
      console.error(
        "AnimePahe getEpisodes: Missing anime session ID in url:",
        url,
      );
      return [];
    }

    // Fetch Page 1 of episodes
    const page1Url = `/api?m=release&id=${session}&sort=episode_asc&page=1`;
    const res1 = await requestAnimePahe(page1Url, providerContext);
    const data1 = parseJsonSafe(res1?.data);

    if (!data1 || !Array.isArray(data1.data)) {
      return [];
    }

    let allReleases = [...data1.data];
    const lastPage = data1.last_page || 1;

    // Fetch remaining pages SEQUENTIALLY with a delay between each
    // to avoid 429 rate limiting from AnimePahe's API
    if (lastPage > 1) {
      for (let p = 2; p <= Math.min(lastPage, 50); p++) {
        // 1200ms delay between each page to stay well under rate limits
        await sleep(1200);

        try {
          const pageRes = await requestAnimePahe(
            `/api?m=release&id=${session}&sort=episode_asc&page=${p}`,
            providerContext,
          );

          if (pageRes?.data) {
            const pageData = parseJsonSafe(pageRes.data);
            if (pageData?.data && Array.isArray(pageData.data)) {
              allReleases.push(...pageData.data);
            }
          }
        } catch (e: any) {
          console.warn(
            `AnimePahe: Failed fetching episodes page ${p}:`,
            e.message,
          );
          if (e.response?.status === 429) {
            console.warn(
              "AnimePahe: Stopping episode pagination due to rate limit.",
            );
            break;
          }
        }
      }
    }

    // Sort by episode ascending
    allReleases.sort(
      (a, b) => (Number(a.episode) || 0) - (Number(b.episode) || 0),
    );

    const episodes: EpisodeLink[] = [];
    for (const item of allReleases) {
      const epNum =
        item.episode !== undefined && item.episode !== null
          ? item.episode
          : "";
      const epTitle =
        item.title && item.title.trim() ? ` - ${item.title.trim()}` : "";
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
    throwProviderError("AnimePahe", "getEpisodes", error);
  }
};
