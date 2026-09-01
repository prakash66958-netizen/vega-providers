const axios = require("axios");
const cheerio = require("cheerio");

async function testSearch(q) {
  try {
    const res = await axios.get(`https://anidao.to/search?keyword=${encodeURIComponent(q)}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
        Referer: "https://anidao.to/",
      },
    });

    console.log("Search status:", res.status);
    const $ = cheerio.load(res.data);
    const results = [];
    $("a[href*='/watch-online/'], a[href*='/anime/']").each((_, a) => {
      const href = $(a).attr("href");
      const title = $(a).attr("title") || $(a).text().trim().replace(/\s+/g, " ");
      const img = $(a).find("img").attr("src") || $(a).find("img").attr("data-src");
      if (href && title && !results.some((r) => r.href === href)) {
        results.push({ title, href, img });
      }
    });

    console.log(`Query '${q}' -> Results found:`, results.length);
    console.log(results.slice(0, 5));
  } catch (err) {
    console.error("Search error:", err.message);
  }
}

testSearch("naruto");
