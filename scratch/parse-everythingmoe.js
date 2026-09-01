const axios = require("axios");
const cheerio = require("cheerio");

async function parseEverythingMoe() {
  const res = await axios.get("https://everythingmoe.com/");
  const $ = cheerio.load(res.data);
  const sections = [];

  $(".section").each((_, s) => {
    const title = $(s).find(".section-title").text().trim();
    const items = [];
    $(s)
      .find(".section-item a")
      .each((_, a) => {
        const name = $(a).text().trim();
        const url = $(a).attr("data-link") || $(a).attr("href");
        if (name && url && !url.startsWith("/s/")) {
          items.push({ name, url });
        }
      });
    sections.push({ title, items });
  });

  for (const sec of sections) {
    if (
      sec.title.toLowerCase().includes("stream") ||
      sec.title.toLowerCase().includes("anime")
    ) {
      console.log(`\n### ${sec.title}`);
      for (const it of sec.items) {
        console.log(`- ${it.name} | ${it.url}`);
      }
    }
  }
}

parseEverythingMoe();
