const axios = require("axios");

const sites = [
  { name: "Anikoto", url: "https://anikototv.to/home" },
  { name: "Miruro", url: "https://www.miruro.to/" },
  { name: "Re:Anime", url: "https://reanime.to/home" },
  { name: "MKissa", url: "https://mkissa.to/anime" },
  { name: "AniZone", url: "https://anizone.to/" },
  { name: "AniNeko", url: "https://anidao.to/" },
  { name: "AnimeOnsen", url: "https://www.animeonsen.xyz/" },
  { name: "AnimeX", url: "https://animex.one/home" },
  { name: "Anify", url: "https://anify.to/" },
  { name: "AnimeKhor", url: "https://animekhor.org/" },
  { name: "AnimeXin", url: "https://animexin.dev/" },
];

async function checkSites() {
  console.log("Testing EverythingMoe anime sites...\n");
  for (const site of sites) {
    try {
      const res = await axios.get(site.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        },
        timeout: 6000,
      });
      console.log(`✓ ${site.name.padEnd(14)} [HTTP ${res.status}] -> ${site.url}`);
    } catch (err) {
      const code = err.response ? err.response.status : err.code;
      console.log(`✗ ${site.name.padEnd(14)} [${code}] -> ${site.url}`);
    }
  }
}

checkSites();
