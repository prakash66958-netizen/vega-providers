const axios = require("axios");
const cheerio = require("cheerio");
const https = require("https");

const agent = new https.Agent({ rejectUnauthorized: false });

async function inspectSites() {
  const sites = [
    { name: "AniZone", home: "https://anizone.to/" },
    { name: "AniDao / AniNeko", home: "https://anidao.to/" },
    { name: "AnimeX", home: "https://animex.one/home" },
  ];

  for (const s of sites) {
    console.log(`\n================= ${s.name} =================`);
    try {
      const res = await axios.get(s.home, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        httpsAgent: agent,
      });

      const $ = cheerio.load(res.data);
      const links = [];
      $("a").each((_, a) => {
        const href = $(a).attr("href");
        const title = $(a).text().trim();
        if (
          href &&
          title &&
          title.length > 2 &&
          !href.startsWith("#") &&
          !href.startsWith("javascript") &&
          (href.includes("anime") || href.includes("watch") || href.includes("detail") || href.includes("ep"))
        ) {
          if (!links.some((l) => l.href === href)) {
            links.push({ title, href });
          }
        }
      });

      console.log(`Found ${links.length} anime links. Sample:`, links.slice(0, 5));
    } catch (e) {
      console.log(`Error on ${s.name}:`, e.message);
    }
  }
}

inspectSites();
