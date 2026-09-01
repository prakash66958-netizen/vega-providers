const axios = require("axios");
const cheerio = require("cheerio");
const https = require("https");

const agent = new https.Agent({ rejectUnauthorized: false });

async function testEp() {
  const epUrl = "https://anidao.to/watch-online/skeleton-knight-in-another-world-season-2-episode-9";
  const res = await axios.get(epUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    },
    httpsAgent: agent,
  });

  console.log("EP STATUS:", res.status);
  const $ = cheerio.load(res.data);
  console.log("IFRAME:", $("iframe").attr("src"));
  $("ul.servers-list li, .server-item, .ps_-block a, .btn-server, a[data-embed]").each((_, el) => {
    console.log("Server:", $(el).text().trim(), $(el).attr("data-embed") || $(el).attr("data-src") || $(el).attr("href"));
  });
}

testEp();
