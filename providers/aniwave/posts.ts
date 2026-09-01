import { Post, ProviderContext } from "../types";
import { getBaseUrl, makeAniwaveRequest } from "./client";
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
  const { cheerio } = providerContext;
  const baseUrl = await getBaseUrl(providerContext);

  try {
    const pageNum = page || 1;
    const path = filter.startsWith("/") ? filter : `/${filter}`;
    const delimiter = path.includes("?") ? "&" : "?";
    const targetUrl = `${baseUrl}${path}${delimiter}page=${pageNum}`;

    const res = await makeAniwaveRequest(targetUrl, providerContext, {
      signal,
      allowWebView: true,
    });

    const html: string = typeof res?.data === "string" ? res.data : "";
    const $ = cheerio.load(html);
    const posts: Post[] = [];

    $(".item, .flw-item, div.inner").each((_, el) => {
      const linkEl = $(el).find("a.name, .poster a, a.d-title, a[href*='/watch/']").first();
      const href = linkEl.attr("href") || $(el).find("a").first().attr("href") || "";
      if (!href || !href.includes("/watch/")) return;

      const title =
        $(el).find("a.name, a.d-title, .d-title, .name").first().text().trim() ||
        linkEl.attr("title") ||
        "";

      const rawImg =
        $(el).find(".poster img, img").attr("src") ||
        $(el).find("img").attr("data-src") ||
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
    throwProviderError("Aniwave", "getPosts", error);
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
  const baseUrl = await getBaseUrl(providerContext);

  try {
    if (!searchQuery || !searchQuery.trim()) {
      return [];
    }

    const pageNum = page || 1;
    const targetUrl = `${baseUrl}/filter?keyword=${encodeURIComponent(searchQuery.trim())}&page=${pageNum}`;

    const res = await makeAniwaveRequest(targetUrl, providerContext, {
      signal,
      allowWebView: true,
    });

    const html: string = typeof res?.data === "string" ? res.data : "";
    const $ = cheerio.load(html);
    const posts: Post[] = [];

    $(".item, .flw-item, div.inner").each((_, el) => {
      const linkEl = $(el).find("a.name, .poster a, a.d-title, a[href*='/watch/']").first();
      const href = linkEl.attr("href") || $(el).find("a").first().attr("href") || "";
      if (!href || !href.includes("/watch/")) return;

      const title =
        $(el).find("a.name, a.d-title, .d-title, .name").first().text().trim() ||
        linkEl.attr("title") ||
        "";

      const rawImg =
        $(el).find(".poster img, img").attr("src") ||
        $(el).find("img").attr("data-src") ||
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
    throwProviderError("Aniwave", "getSearchPosts", error);
  }
};
