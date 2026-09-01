const axios = require("axios");
const cheerio = require("cheerio");
const https = require("https");

const agent = new https.Agent({ rejectUnauthorized: false });

async function testAniDao() {
  console.log("Testing AniDao (anidao.to)...");

  // 1. Episode page
  const epUrl = "https://anidao.to/watch-online/skeleton-knight-in-another-world-season-2-episode-9";
  const res = await axios.get(epUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    httpsAgent: agent,
  });

  console.log("Status:", res.status);
  const $ = cheerio.load(res.data);

  // Player iframe or servers
  const iframeSrc = $("iframe").attr("src");
  console.log("IFRAME SRC:", iframeSrc);

  const servers = [];
  $(".server, .servers a, [data-video], li[data-server]").each((_, el) => {
    servers.push({
      text: $(el).text().trim(),
      video: $(el).attr("data-video") || $(el).attr("data-src") || $(el).attr("href"),
    });
  });

  console.log("SERVERS FOUND:", servers);

  // Search
  console.log("\nTesting search on anidao.to...");
  const sRes = await axios.get("https://anidao.to/search?keyword=one+piece", {
    headers: { "User-Agent": "Mozilla/5.0" },
    httpsAgent: agent,
  });
  const $s = cheerio.load(sRes.data);
  const sList = [];
  $s(".film-detail, .flw-item, .anime-item, a[href*='/anime/'], a[href*='/detail/']").each((_, el) => {
    sList.push({
      text: $s(el).text().trim().replace(/\s+/g, " "),
      href: $s(el).attr("href") || $s(el).find("a").attr("href"),
    });
  });
  console.log("SEARCH RESULTS:", sList.length, sList.slice(0, 3));
}

testAniDao();
