const axios = require("axios");
const cheerio = require("cheerio");
const https = require("https");

const agent = new https.Agent({ rejectUnauthorized: false });

async function testYugen() {
  console.log("Testing YugenAnime (yugenanime.tv)...");
  try {
    const res = await axios.get("https://yugenanime.tv/trending/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      httpsAgent: agent,
    });

    console.log("Status:", res.status, "HTML length:", res.data.length);
    const $ = cheerio.load(res.data);
    const animes = [];
    $(".anime-meta, .cards-grid a, .ep-card, a.anime-item").each((_, el) => {
      const title = $(el).find(".anime-details span, .title").text().trim() || $(el).attr("title");
      const href = $(el).attr("href");
      const img = $(el).find("img").attr("data-src") || $(el).find("img").attr("src");
      if (title && href) {
        animes.push({ title, href, img });
      }
    });

    console.log("Trending animes found:", animes.length, animes.slice(0, 3));
  } catch (err) {
    console.error("Yugen error:", err.message);
  }
}

testYugen();
