import { Info, ProviderContext } from "../types";
import { requestAnimePahe } from "./client";

export const getMeta = async function ({
  link,
  providerContext,
}: {
  link: string;
  provider: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  const { cheerio } = providerContext;

  const session = link.split("/").filter(Boolean).pop() || "";
  const animeUrl = `/anime/${session}`;

  try {
    const response = await requestAnimePahe(animeUrl, providerContext, {
      isHtml: true,
    });
    const html = response.data;
    const $ = cheerio.load(html);

    // Extract Titles
    const title =
      $("div.title-wrapper h1").first().text().trim() ||
      $("h1").first().text().trim() ||
      session;
    const japaneseTitle = $("div.title-wrapper h2").first().text().trim();

    // Extract Poster
    let image =
      $("div.anime-poster a").attr("href") ||
      $("div.anime-poster img").attr("src") ||
      $("div.poster img").attr("src") ||
      "";
    if (image.startsWith("//")) {
      image = "https:" + image;
    }

    // Extract Synopsis
    const synopsis = $("div.anime-synopsis").text().trim() || "";

    // Extract Genres / Tags
    const tags: string[] = [];
    $("div.anime-genre ul li a").each((_, el) => {
      const tag = $(el).text().trim();
      if (tag) tags.push(tag);
    });

    // Check Type (TV Series vs Movie)
    const animeInfoText = $("div.anime-info").text().toLowerCase();
    const isMovie =
      animeInfoText.includes("type: movie") ||
      animeInfoText.includes("type:  movie");

    // Dynamic Episodes link using AnimePahe API
    const episodesLink = `/api?m=release&id=${session}&sort=episode_asc`;

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
    console.error("AnimePahe getMeta error:", error);
    return {
      title: session,
      image: "",
      synopsis: "",
      imdbId: "",
      type: "series",
      linkList: [
        {
          title: "Episodes",
          episodesLink: `/api?m=release&id=${session}&sort=episode_asc`,
        },
      ],
    };
  }
};
