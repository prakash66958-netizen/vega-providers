import { Info, ProviderContext } from "../types";
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

export const getMeta = async function ({
  link,
  providerContext,
}: {
  link: string;
  provider?: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  const { cheerio } = providerContext;
  const baseUrl = await getBaseUrl(providerContext);

  try {
    const targetUrl = link.startsWith("http")
      ? link
      : `${baseUrl}${link.startsWith("/") ? "" : "/"}${link}`;

    const res = await makeAniwaveRequest(targetUrl, providerContext, {
      allowWebView: false,
    });

    const html = typeof res?.data === "string" ? res.data : "";
    const $ = cheerio.load(html);

    // Extract anime ID
    let animeId =
      $("#watch-main").attr("data-id") ||
      $("[data-id]").first().attr("data-id") ||
      "";

    if (!animeId) {
      const match = link.match(/-(\d+)(?:\?|$|\/)/);
      if (match) {
        animeId = match[1];
      }
    }

    // Title
    const title =
      $("h1.title, h1.name, .d-title, h1").first().text().trim() ||
      $('meta[property="og:title"]').attr("content") ||
      "Anime";

    const japaneseTitle =
      $(".d-title").attr("data-jp") ||
      $("[data-jp]").first().attr("data-jp") ||
      "";

    // Poster
    const rawImage =
      $('meta[property="og:image"]').attr("content") ||
      $(".poster img, .ani.poster img").attr("src") ||
      "";
    const image = formatImageUrl(rawImage, baseUrl);

    // Synopsis
    const synopsis =
      $(".synopsis .shorting, .synopsis, .description").first().text().trim() ||
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

    const fullText = $("body").text().toLowerCase();
    const isMovie = fullText.includes("movie") || link.includes("movie");

    const episodesLink = `/ajax/episode/list/${animeId || "0"}`;

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
    throwProviderError("Aniwave", "getMeta", error);
  }
};
