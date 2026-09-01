import { Post, ProviderContext } from "../types";
import { requestAnimePahe } from "./client";
import { throwProviderError } from "../providerErrors";

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
  const { cheerio } = providerContext;

  try {
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

    const posts: Post[] = [];
    const jsonResult = parseJsonSafe(response?.data);

    // 1. If API returned JSON, parse items from JSON
    if (jsonResult) {
      const items = Array.isArray(jsonResult)
        ? jsonResult
        : Array.isArray(jsonResult?.data)
          ? jsonResult.data
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

      if (posts.length > 0) {
        return posts;
      }
    }

    // 2. Fallback: If response was HTML, scrape posts from HTML elements
    const rawHtml = typeof response?.data === "string" ? response.data : "";
    if (rawHtml && cheerio) {
      const $ = cheerio.load(rawHtml);

      $("div.latest-release, div.episode-wrap, div.poster, a[href*='/anime/']").each(
        (_, el) => {
          const anchor = $(el).is("a") ? $(el) : $(el).find("a").first();
          const href = anchor.attr("href") || "";
          const img = $(el).find("img").attr("src") || anchor.find("img").attr("src") || "";
          const title =
            anchor.attr("title") ||
            $(el).find(".title, .anime-title, h2, h3").first().text().trim() ||
            anchor.text().trim();

          if (href && href.includes("/anime/") && title && !posts.some((p) => p.link === href)) {
            posts.push({
              title,
              link: href.startsWith("http") ? new URL(href).pathname : href,
              image: img.startsWith("//") ? `https:${img}` : img,
            });
          }
        },
      );
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
  const { cheerio } = providerContext;

  try {
    if (!searchQuery || !searchQuery.trim()) {
      return [];
    }

    const endpoint = `/api?m=search&q=${encodeURIComponent(searchQuery.trim())}`;
    const response = await requestAnimePahe(endpoint, providerContext, {
      signal,
    });

    const posts: Post[] = [];
    const jsonResult = parseJsonSafe(response?.data);

    // 1. If API returned JSON, parse items from JSON
    if (jsonResult) {
      const items = Array.isArray(jsonResult)
        ? jsonResult
        : Array.isArray(jsonResult?.data)
          ? jsonResult.data
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

      if (posts.length > 0) {
        return posts;
      }
    }

    // 2. Fallback: If response was HTML, scrape search results from HTML
    const rawHtml = typeof response?.data === "string" ? response.data : "";
    if (rawHtml && cheerio) {
      const $ = cheerio.load(rawHtml);

      $("a[href*='/anime/']").each((_, el) => {
        const href = $(el).attr("href") || "";
        const title = $(el).attr("title") || $(el).text().trim();
        const img = $(el).find("img").attr("src") || "";

        if (href && href.includes("/anime/") && title && !posts.some((p) => p.link === href)) {
          posts.push({
            title,
            link: href.startsWith("http") ? new URL(href).pathname : href,
            image: img.startsWith("//") ? `https:${img}` : img,
          });
        }
      });
    }

    return posts;
  } catch (error) {
    throwProviderError("AnimePahe", "getSearchPosts", error);
  }
};
