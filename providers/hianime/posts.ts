import { Post, ProviderContext } from "../types";
import { getBaseUrl, getHiAnimeHeaders } from "./client";
import { throwProviderError } from "../providerErrors";

function formatImageUrl(rawUrl: string, baseUrl: string): string {
  if (!rawUrl) return "";
  let img = rawUrl.trim();
  if (img.startsWith("//")) {
    img = "https:" + img;
  } else if (img.startsWith("/")) {
    img = `${baseUrl}${img}`;
  }
  return img;
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
  const { axios, cheerio } = providerContext;
  const baseUrl = await getBaseUrl(providerContext);

  try {
    const pageNum = page || 1;
    const path = filter.startsWith("/") ? filter : `/${filter}`;
    const delimiter = path.includes("?") ? "&" : "?";
    const targetUrl = `${baseUrl}${path}${delimiter}page=${pageNum}`;

    const res = await axios.get(targetUrl, {
      headers: getHiAnimeHeaders(baseUrl),
      signal,
    });

    const html: string = typeof res.data === "string" ? res.data : "";
    const $ = cheerio.load(html);
    const posts: Post[] = [];

    $(".film_list-wrap .flw-item, .film_list-wrap .item, .flw-item").each((_, el) => {
      const posterLink = $(el).find(".film-poster a, a.film-poster-ahref, a.film-poster").first();
      const detailLink = $(el).find(".film-detail .film-name a, .dynamic-name a, h3 a, a").first();

      const href = posterLink.attr("href") || detailLink.attr("href") || $(el).find("a").first().attr("href") || "";
      if (!href) return;

      const title =
        detailLink.attr("title") ||
        detailLink.text().trim() ||
        posterLink.attr("title") ||
        $(el).find(".film-name, .dynamic-name, h3").first().text().trim() ||
        "";

      const rawImg =
        $(el).find(".film-poster-img").attr("src") ||
        $(el).find(".film-poster img").attr("src") ||
        $(el).find("img").attr("src") ||
        "";
      const image = formatImageUrl(rawImg, baseUrl);

      const link = href.startsWith("http") ? new URL(href).pathname : href;

      if (title && link && !posts.some((p) => p.link === link)) {
        posts.push({
          title,
          link,
          image,
        });
      }
    });

    return posts;
  } catch (error) {
    throwProviderError("HiAnime", "getPosts", error);
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
  const { axios, cheerio } = providerContext;
  const baseUrl = await getBaseUrl(providerContext);

  try {
    if (!searchQuery || !searchQuery.trim()) {
      return [];
    }

    const pageNum = page || 1;
    const targetUrl = `${baseUrl}/search?keyword=${encodeURIComponent(searchQuery.trim())}&page=${pageNum}`;

    const res = await axios.get(targetUrl, {
      headers: getHiAnimeHeaders(baseUrl),
      signal,
    });

    const html: string = typeof res.data === "string" ? res.data : "";
    const $ = cheerio.load(html);
    const posts: Post[] = [];

    $(".film_list-wrap .flw-item, .film_list-wrap .item, .flw-item").each((_, el) => {
      const posterLink = $(el).find(".film-poster a, a.film-poster-ahref, a.film-poster").first();
      const detailLink = $(el).find(".film-detail .film-name a, .dynamic-name a, h3 a, a").first();

      const href = posterLink.attr("href") || detailLink.attr("href") || $(el).find("a").first().attr("href") || "";
      if (!href) return;

      const title =
        detailLink.attr("title") ||
        detailLink.text().trim() ||
        posterLink.attr("title") ||
        $(el).find(".film-name, .dynamic-name, h3").first().text().trim() ||
        "";

      const rawImg =
        $(el).find(".film-poster-img").attr("src") ||
        $(el).find(".film-poster img").attr("src") ||
        $(el).find("img").attr("src") ||
        "";
      const image = formatImageUrl(rawImg, baseUrl);

      const link = href.startsWith("http") ? new URL(href).pathname : href;

      if (title && link && !posts.some((p) => p.link === link)) {
        posts.push({
          title,
          link,
          image,
        });
      }
    });

    return posts;
  } catch (error) {
    throwProviderError("HiAnime", "getSearchPosts", error);
  }
};
