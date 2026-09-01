import { Info, ProviderContext } from "../types";
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
      headers: getHiAnimeHeaders(baseUrl),
    });

    const html = typeof res.data === "string" ? res.data : "";
    const $ = cheerio.load(html);

    // Extract anime ID
    let animeId =
      $('meta[name="hi-anime-id"]').attr("content") ||
      $("#ani_detail").attr("data-anime-id") ||
      $("[data-anime-id]").first().attr("data-anime-id") ||
      "";

    if (!animeId) {
      const match = link.match(/-(\d+)(?:\?|$)/);
      if (match) {
        animeId = match[1];
      }
    }

    // Title
    const title =
      $("h1.film-name, h2.film-name, .film-title, .dynamic-name").first().text().trim() ||
      $('meta[property="og:title"]').attr("content") ||
      "Anime";

    const japaneseTitle =
      $(".film-name .dynamic-name").attr("data-jname") ||
      $("[data-jname]").first().attr("data-jname") ||
      "";

    // Poster
    const rawImage =
      $(".film-poster-img").attr("src") ||
      $(".film-poster img").attr("src") ||
      $('meta[property="og:image"]').attr("content") ||
      "";
    const image = formatImageUrl(rawImage, baseUrl);

    // Synopsis
    const synopsis =
      $(".film-description .text, .item-description, .film-description").first().text().trim() ||
      $('meta[property="og:description"]').attr("content") ||
      "";

    // Genres & Tags
    const tags: string[] = [];
    $(".item-list a, .genre a, a[href*='/genre/']").each((_, el) => {
      const tag = $(el).text().trim();
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
      }
    });

    // Check Type
    const fullText = $(".film-stats, .film-infor, .fd-infor").text().toLowerCase();
    const isMovie = fullText.includes("movie") || link.includes("/movie");

    // Dynamic Episodes link
    const episodesLink = `/api/theme/episode/list/${animeId || "0"}`;

    return {
      title,
      image,
      poster: image,
      synopsis: japaneseTitle ? `[${japaneseTitle}]\n\n${synopsis}` : synopsis,
      imdbId: "",
      type: isMovie ? "movie" : "series",
      tags,
      linkList: [
        {
          title: isMovie ? "Movie" : "Episodes",
          episodesLink,
        },
      ],
    };
  } catch (error) {
    throwProviderError("HiAnime", "getMeta", error);
  }
};
