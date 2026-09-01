import { Info, ProviderContext } from "../types";
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

export const getMeta = async function ({
  link,
  providerContext,
}: {
  link: string;
  provider?: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  const { axios, cheerio } = providerContext;
  const baseUrl = await getBaseUrl(providerContext);

  try {
    const targetUrl = link.startsWith("http")
      ? link
      : `${baseUrl}${link.startsWith("/") ? "" : "/"}${link}`;

    const res = await axios.get(targetUrl, {
      headers: getAniDaoHeaders(baseUrl),
    });

    const html = typeof res.data === "string" ? res.data : "";
    const $ = cheerio.load(html);

    // Title
    let title =
      $("h1, h2.title, .film-name, h2").first().text().trim() ||
      $('meta[property="og:title"]').attr("content") ||
      "Anime";

    // Clean up episode suffix if link was a watch-online link
    const cleanTitle = title.replace(/\s*-\s*Episode\s*\d+/i, "").trim() || title;

    // Image
    const rawImage =
      $('meta[property="og:image"]').attr("content") ||
      $(".film-poster img, .cover img, img").first().attr("src") ||
      $(".film-poster img, .cover img, img").first().attr("data-src") ||
      "";
    const image = formatImageUrl(rawImage, baseUrl);

    // Synopsis
    const synopsis =
      $(".film-description, .description, .synopsis, p.text-muted").first().text().trim() ||
      $('meta[property="og:description"]').attr("content") ||
      "";

    // Genres & Tags
    const tags: string[] = [];
    $("a[href*='/genre/'], .genre a, .genres a").each((_, el) => {
      const tag = $(el).text().trim();
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
      }
    });

    const isMovie = link.includes("/movie/") || cleanTitle.toLowerCase().includes("movie");

    return {
      title: cleanTitle,
      image,
      poster: image,
      synopsis,
      imdbId: "",
      type: isMovie ? "movie" : "series",
      tags,
      linkList: [
        {
          title: isMovie ? "Movie" : "Episodes",
          episodesLink: link,
        },
      ],
    };
  } catch (error) {
    throwProviderError("AniDao", "getMeta", error);
  }
};
