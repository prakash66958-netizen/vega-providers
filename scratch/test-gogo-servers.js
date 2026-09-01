const axios = require("axios");
const cheerio = require("cheerio");
const https = require("https");

const agent = new https.Agent({ rejectUnauthorized: false });

async function testGogo() {
  console.log("Testing GogoAnime (anitaku.bz)...");

  // 1. Recent Releases / Popular
  const homeRes = await axios.get("https://anitaku.bz/home.html", {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    httpsAgent: agent,
  });

  const $ = cheerio.load(homeRes.data);
  const posts = [];
  $(".last_episodes ul.items li").each((_, el) => {
    const a = $(el).find("p.name a");
    const title = a.text().trim();
    const href = a.attr("href");
    const img = $(el).find(".img img").attr("src");
    if (title && href) {
      posts.push({ title, link: href, image: img });
    }
  });

  console.log("POSTS:", posts.length, posts[0]);

  if (posts.length > 0) {
    const epLink = posts[0].link;
    // Episode page
    const epRes = await axios.get(`https://anitaku.bz${epLink}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      httpsAgent: agent,
    });
    const $ep = cheerio.load(epRes.data);
    const animeTitle = $ep(".anime-info a").text().trim() || $ep("h1").text().trim();
    const defaultIframe = $ep(".play-video iframe").attr("src");
    console.log("ANIME TITLE:", animeTitle);
    console.log("DEFAULT IFRAME:", defaultIframe);

    // Servers list
    const servers = [];
    $ep(".anime_muti_link ul li").each((_, el) => {
      const sName = $(el).text().replace("Choose this server", "").trim();
      const sData = $(el).find("a").attr("data-video");
      if (sName && sData) {
        servers.push({ name: sName, embed: sData.startsWith("//") ? `https:${sData}` : sData });
      }
    });

    console.log("SERVERS:", servers);
  }
}

testGogo();
