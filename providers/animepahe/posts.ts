import { Post, ProviderContext } from "../types";
import { requestAnimePahe, ensureCfClearance } from "./client";
import { throwProviderError } from "../providerErrors";

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
    await ensureCfClearance(providerContext);
    const pageNum = page || 1;
    let endpoint = `/api?m=airing&page=${pageNum}`;

    if (
      filter &&
      filter !== "airing" &&
      filter !== "all" &&
      filter.trim() !== ""
    ) {
      endpoint = `/api?m=search&q=${encodeURIComponent(filter.trim())}`;
    }

    const response = await requestAnimePahe(endpoint, providerContext, {
      signal,
    });
    const result =
      typeof response.data === "string"
        ? JSON.parse(response.data)
        : response.data;
    const posts: Post[] = [];

    const items = Array.isArray(result)
      ? result
      : Array.isArray(result?.data)
        ? result.data
        : [];

    for (const item of items) {
      if (item.anime_session) {
        const epSuffix =
          item.episode !== undefined && item.episode !== null
            ? ` - Ep ${item.episode}`
            : "";
        posts.push({
          title: `${item.anime_title || "Anime"}${epSuffix}`,
          link: `/anime/${item.anime_session}`,
          image: item.snapshot || item.poster || "",
        });
      } else if (item.session) {
        const yearStr = item.year ? ` (${item.year})` : "";
        posts.push({
          title: `${item.title || "Anime"}${yearStr}`,
          link: `/anime/${item.session}`,
          image: item.poster || item.snapshot || "",
        });
      }
    }

    return posts;
  } catch (error) {
    throwProviderError("AnimePahe", "getPosts", error);
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
    await ensureCfClearance(providerContext);
    if (!searchQuery || !searchQuery.trim()) {
      return [];
    }

    const endpoint = `/api?m=search&q=${encodeURIComponent(searchQuery.trim())}`;
    const response = await requestAnimePahe(endpoint, providerContext, {
      signal,
    });
    const result =
      typeof response.data === "string"
        ? JSON.parse(response.data)
        : response.data;
    const posts: Post[] = [];

    const items = Array.isArray(result)
      ? result
      : Array.isArray(result?.data)
        ? result.data
        : [];

    for (const item of items) {
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

    return posts;
  } catch (error) {
    throwProviderError("AnimePahe", "getSearchPosts", error);
  }
};
