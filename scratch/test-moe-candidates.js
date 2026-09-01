const axios = require("axios");
const https = require("https");

const agent = new https.Agent({ rejectUnauthorized: false });

const testList = [
  "https://anizone.to/",
  "https://anidao.to/",
  "https://anime.uniquestream.net/",
  "https://anisnatch.to/home",
  "https://animex.one/home",
  "https://anify.to/",
  "https://animeheaven.me/",
  "https://animeflix.live/",
  "https://kickassanime.am/",
  "https://aniwatchtv.to/",
  "https://otaku-streamers.com/",
  "https://animeav.com/",
  "https://hianime.to/home",
  "https://hianime.sx/home",
  "https://kaido.to/home",
];

async function check() {
  for (const url of testList) {
    try {
      const res = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
        },
        httpsAgent: agent,
        timeout: 4000,
      });
      console.log(`✓ [${res.status}] Length: ${res.data.length} -> ${url}`);
    } catch (e) {
      console.log(`✗ [${e.response ? e.response.status : e.message}] -> ${url}`);
    }
  }
}

check();
