import { Post, ProviderContext } from "../types";
import { requestAnimePahe } from "./client";

export const getPosts = async function ({
  filter,
  page,
  signal,
  providerContext,
}: {
  filter: string;
  page: number;
  providerValue: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Post[]> {
  try {
    const pageNum = page || 1;
    let endpoint = `/api?m=airing&page=${pageNum}`;

    if (filter && filter !== "airing" && filter !== "all") {
      // If a genre or keyword is passed, search for it
      endpoint = `/api?m=search&q=${encodeURIComponent(filter)}`;
    }

    const response = await requestAnimePahe(endpoint, providerContext, {
      signal,
    });
    const result = response.data;
    const posts: Post[] = [];

    if (result && Array.isArray(result.data)) {
      for (const item of result.data) {
        // Airing format
        if (item.anime_session) {
          const epSuffix = item.episode ? ` - Ep ${item.episode}` : "";
          posts.push({
            title: `${item.anime_title || "Anime"}${epSuffix}`,
            link: `/anime/${item.anime_session}`,
            image: item.snapshot || item.poster || "",
          });
        }
        // Search / Anime list format
        else if (item.session) {
          const yearStr = item.year ? ` (${item.year})` : "";
          posts.push({
            title: `${item.title || "Anime"}${yearStr}`,
            link: `/anime/${item.session}`,
            image: item.poster || item.snapshot || "",
          });
        }
      }
    }

    return posts;
  } catch (error) {
    console.error("AnimePahe getPosts error:", error);
    return [];
  }
};

export const getSearchPosts = async function ({
  searchQuery,
  page,
  signal,
  providerContext,
}: {
  searchQuery: string;
  page: number;
  providerValue: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Post[]> {
  try {
    if (!searchQuery || !searchQuery.trim()) {
      return [];
    }

    const endpoint = `/api?m=search&q=${encodeURIComponent(searchQuery.trim())}`;
    const response = await requestAnimePahe(endpoint, providerContext, {
      signal,
    });
    const result = response.data;
    const posts: Post[] = [];

    if (result && Array.isArray(result.data)) {
      for (const item of result.data) {
        if (item.session) {
          const yearStr = item.year ? ` (${item.year})` : "";
          const typeStr = item.type ? ` [${item.type}]` : "";
          posts.push({
            title: `${item.title || "Anime"}${yearStr}${typeStr}`,
            link: `/anime/${item.session}`,
            image: item.poster || item.snapshot || "",
          });
        }
      }
    }

    return posts;
  } catch (error) {
    console.error("AnimePahe getSearchPosts error:", error);
    return [];
  }
};
