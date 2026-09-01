const axios = require("axios");
const cheerio = require("cheerio");

async function inspectAniDaoDetail() {
  console.log("Inspecting AniDao catalog & anime detail...");

  // 1. Anime catalog
  const catRes = await axios.get("https://anidao.to/animelist", {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });

  const $ = cheerio.load(catRes.data);
  const posts = [];
  $(".flw-item, .film_list-wrap .film-poster, .film-detail, .film_list .flw-item, .item").each((_, el) => {
    const a = $(el).find("a.film-poster-ahref, a.dynamic-name, a").first();
    const href = a.attr("href");
    const title = $(el).find(".film-name, .dynamic-name, h3").text().trim() || a.attr("title");
    const img = $(el).find("img.film-poster-img, img").attr("data-src") || $(el).find("img").attr("src");
    if (href && title && !posts.some((p) => p.link === href)) {
      posts.push({ title, link: href, image: img });
    }
  });

  console.log("CATALOG POSTS:", posts.length, posts.slice(0, 3));

  if (posts.length > 0) {
    const detailUrl = posts[0].link.startsWith("http") ? posts[0].link : `https://anidao.to${posts[0].link}`;
    console.log("\nFetching detail:", detailUrl);
    const detRes = await axios.get(detailUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const $det = cheerio.load(detRes.data);
    const title = $det("h2.film-name, h1.film-name, .heading-name").text().trim();
    const synopsis = $det(".film-description .text, .description, .film-desc").text().trim();
    const poster = $det(".film-poster img").attr("src") || $det(".film-poster img").attr("data-src");

    console.log("TITLE:", title);
    console.log("SYNOPSIS:", synopsis.slice(0, 100));
    console.log("POSTER:", poster);

    // Episode list
    const eps = [];
    $det(".episodes-ul a, .ss-list a, .ssl-item, a[href*='/watch-online/']").each((_, el) => {
      const href = $det(el).attr("href");
      const epNum = $det(el).attr("data-number") || $det(el).text().trim();
      const epTitle = $det(el).attr("title") || `Episode ${epNum}`;
      if (href && !eps.some((e) => e.link === href)) {
        eps.push({ title: `Episode ${epNum} - ${epTitle}`, link: href });
      }
    });
    console.log("EPISODES FOUND:", eps.length, eps.slice(0, 5));
  }
}

inspectAniDaoDetail();
