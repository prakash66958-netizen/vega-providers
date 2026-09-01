const axios = require("axios");
const cheerio = require("cheerio");

async function parseAniDaoHome() {
  const res = await axios.get("https://anidao.to/", {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });

  const $ = cheerio.load(res.data);
  console.log("=== NAV / CATEGORIES ===");
  $("a").each((_, a) => {
    const href = $(a).attr("href");
    const text = $(a).text().trim().replace(/\s+/g, " ");
    if (href && (href.startsWith("/genre") || href.startsWith("/sub") || href.startsWith("/dub") || href.startsWith("/movie") || href.startsWith("/popular") || href.startsWith("/ongoing") || href.startsWith("/recently"))) {
      console.log(`${text} -> ${href}`);
    }
  });

  console.log("\n=== POSTS ===");
  const posts = [];
  $("a[href*='/watch-online/'], a[href*='/anime/']").each((_, a) => {
    const href = $(a).attr("href");
    const title = $(a).attr("title") || $(a).text().trim().replace(/\s+/g, " ");
    const img = $(a).find("img").attr("src") || $(a).find("img").attr("data-src");
    if (href && title && !posts.some((p) => p.href === href)) {
      posts.push({ title, href, img });
    }
  });

  console.log(`Found ${posts.length} posts on home page:`);
  console.log(posts.slice(0, 10));
}

parseAniDaoHome();
