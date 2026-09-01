const axios = require("axios");
const https = require("https");

const agent = new https.Agent({ rejectUnauthorized: false });

const candidates = [
  "https://anitaku.bz/home.html",
  "https://gogoanime3.co/home.html",
  "https://anitaku.pe/home.html",
  "https://allanime.to/",
  "https://allanime.day/",
  "https://animeflv.net/",
  "https://animekai.to/home",
  "https://yugenanime.tv/",
  "https://yugenanime.ro/",
  "https://aniwave.to/",
  "https://9animetv.to/",
  "https://gogoanime.news/",
  "https://animesuge.to/",
];

async function run() {
  for (const url of candidates) {
    try {
      const res = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        httpsAgent: agent,
        timeout: 5000,
      });
      console.log(`✓ [${res.status}] ${url}`);
    } catch (e) {
      console.log(`✗ [${e.response ? e.response.status : e.message}] ${url}`);
    }
  }
}

run();
