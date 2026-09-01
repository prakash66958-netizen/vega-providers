const axios = require("axios");
const cheerio = require("cheerio");

async function parseEpisodePage() {
  const url = "https://anidao.to/watch-online/one-piece-episode-1176";
  const res = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });

  const $ = cheerio.load(res.data);
  console.log("TITLE:", $("h1").text().trim());
  console.log("DESCRIPTION:", $(".description, .synopsis, p.text-muted").first().text().trim());

  // Episode buttons / links on page
  const eps = [];
  $("a[href*='/watch-online/']").each((_, a) => {
    const href = $(a).attr("href");
    const epText = $(a).text().trim().replace(/\s+/g, " ");
    if (href && !eps.some((e) => e.href === href)) {
      eps.push({ epText, href });
    }
  });

  console.log(`Found ${eps.length} episode links on page:`);
  console.log(eps.slice(0, 10));

  // Video embed
  const iframe = $("iframe").attr("src");
  console.log("\nIFRAME EMBED:", iframe);
}

parseEpisodePage();
