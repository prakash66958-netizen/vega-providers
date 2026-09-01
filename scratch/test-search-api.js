const axios = require("axios");
const cheerio = require("cheerio");

async function checkSearchEndpoints() {
  const q = "one piece";
  const endpoints = [
    `https://anidao.to/ajax-search.html?keyword=${encodeURIComponent(q)}`,
    `https://anidao.to/ajax/search?keyword=${encodeURIComponent(q)}`,
    `https://anidao.to/suggest?keyword=${encodeURIComponent(q)}`,
    `https://anidao.to/api/search?q=${encodeURIComponent(q)}`,
    `https://anidao.to/search.html?keyword=${encodeURIComponent(q)}`,
    `https://anidao.to/search?keyword=${encodeURIComponent(q)}`,
    `https://anidao.to/filter?keyword=${encodeURIComponent(q)}`,
  ];

  for (const ep of endpoints) {
    try {
      const res = await axios.get(ep, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
          "X-Requested-With": "XMLHttpRequest",
          Referer: "https://anidao.to/",
        },
      });
      console.log(`✓ [${res.status}] Length: ${res.data.length} -> ${ep}`);
    } catch (e) {
      console.log(`✗ [${e.response ? e.response.status : e.message}] -> ${ep}`);
    }
  }
}

checkSearchEndpoints();
