import { Post, ProviderContext } from "../types";
import { getBaseUrl, getAniDaoHeaders } from "./client";
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
    let targetUrl = "";

    if (!filter || filter === "/" || filter === "home") {
      targetUrl = `${baseUrl}/?page=${pageNum}`;
    } else {
      const path = filter.startsWith("/") ? filter : `/${filter}`;
      const delimiter = path.includes("?") ? "&" : "?";
      targetUrl = `${baseUrl}${path}${delimiter}page=${pageNum}`;
    }

    const res = await axios.get(targetUrl, {
      headers: getAniDaoHeaders(baseUrl),
      signal,
    });

    const html: string = typeof res.data === "string" ? res.data : "";
    const $ = cheerio.load(html);
    const posts: Post[] = [];

    $("a[href*='/watch-online/'], a[href*='/anime/']").each((_, a) => {
      const href = $(a).attr("href");
      if (!href || href === "/" || href.startsWith("#") || href.startsWith("javascript")) {
        return;
      }

      const rawTitle = $(a).attr("title") || $(a).text().trim().replace(/\s+/g, " ");
      if (!rawTitle || rawTitle.length < 2 || rawTitle.toLowerCase().includes("view all")) {
        return;
      }

      const rawImg = $(a).find("img").attr("src") || $(a).find("img").attr("data-src") || "";
      const image = formatImageUrl(rawImg, baseUrl);

      const link = href.startsWith("http") ? new URL(href).pathname : href;

      if (!posts.some((p) => p.link === link)) {
        posts.push({
          title: rawTitle,
          link,
          image,
        });
      }
    });

    return posts;
  } catch (error) {
    throwProviderError("AniDao", "getPosts", error);
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

    const searchUrl = `${baseUrl}/ajax-search.html?keyword=${encodeURIComponent(searchQuery.trim())}`;
    const res = await axios.get(searchUrl, {
      headers: {
        ...getAniDaoHeaders(baseUrl),
        "X-Requested-With": "XMLHttpRequest",
      },
      signal,
    });

    const posts: Post[] = [];
    const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
    const items = data?.items || data?.top_matches || [];

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        if (!item?.url || !item?.title) continue;
        const link = item.url.startsWith("http") ? new URL(item.url).pathname : item.url;
        const image = formatImageUrl(item.poster || "", baseUrl);

        if (!posts.some((p) => p.link === link)) {
          posts.push({
            title: item.title,
            link,
            image,
          });
        }
      }
      return posts;
    }

    // Fallback filter page if ajax returned empty
    const filterUrl = `${baseUrl}/filter?keyword=${encodeURIComponent(searchQuery.trim())}&page=${page || 1}`;
    const fRes = await axios.get(filterUrl, {
      headers: getAniDaoHeaders(baseUrl),
      signal,
    });

    const $ = cheerio.load(typeof fRes.data === "string" ? fRes.data : "");
    $("a[href*='/watch-online/'], a[href*='/anime/']").each((_, a) => {
      const href = $(a).attr("href");
      if (!href) return;
      const rawTitle = $(a).attr("title") || $(a).text().trim().replace(/\s+/g, " ");
      if (!rawTitle || rawTitle.length < 2) return;

      const rawImg = $(a).find("img").attr("src") || $(a).find("img").attr("data-src") || "";
      const image = formatImageUrl(rawImg, baseUrl);
      const link = href.startsWith("http") ? new URL(href).pathname : href;

      if (!posts.some((p) => p.link === link)) {
        posts.push({
          title: rawTitle,
          link,
          image,
        });
      }
    });

    return posts;
  } catch (error) {
    throwProviderError("AniDao", "getSearchPosts", error);
  }
};
