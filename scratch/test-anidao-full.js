const axios = require("axios");
const cheerio = require("cheerio");

async function runTest() {
  console.log("Testing Complete AniDao (anidao.to) Pipeline...\n");

  // 1. Search / Posts
  const searchUrl = "https://anidao.to/ajax-search.html?keyword=one%20piece";
  const sRes = await axios.get(searchUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://anidao.to/",
    },
  });

  const items = sRes.data?.items || [];
  console.log(`✓ 1. Search: Found ${items.length} items. Top: ${items[0]?.title} (${items[0]?.url})`);

  const targetAnime = items[0];
  const animePageUrl = targetAnime.url.startsWith("http")
    ? targetAnime.url
    : `https://anidao.to${targetAnime.url}`;

  // 2. Meta
  const detRes = await axios.get(animePageUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const $det = cheerio.load(detRes.data);
  const title = $det("h1, h2").first().text().trim();
  const synopsis = $det(".film-description, .description, p.text-muted").text().trim();
  const rawEpisodes = [];
  $det("a[href*='/watch-online/']").each((_, a) => {
    const href = $det(a).attr("href");
    const t = $det(a).text().trim().replace(/\s+/g, " ");
    if (href && !rawEpisodes.some((e) => e.href === href)) {
      rawEpisodes.push({ title: t, href });
    }
  });

  console.log(`✓ 2. Meta: Title='${title}' Episodes Count=${rawEpisodes.length}`);

  // 3. Episodes / Stream
  const sampleEp = rawEpisodes.find((e) => e.href.includes("1176")) || rawEpisodes[0];
  const epUrl = sampleEp.href.startsWith("http") ? sampleEp.href : `https://anidao.to${sampleEp.href}`;
  console.log(`✓ 3. Episode URL: ${epUrl}`);

  const epRes = await axios.get(epUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const $ep = cheerio.load(epRes.data);
  const iframeSrc = $ep("iframe").attr("src");
  console.log(`✓ 4. Player Embed: ${iframeSrc}`);

  // 4. Resolve Stream from Embed
  if (iframeSrc) {
    const embedRes = await axios.get(iframeSrc, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://anidao.to/" },
    });

    let m3u8Url = "";
    // Check direct const src = "..."
    const srcMatch = embedRes.data.match(/const\s+src\s*=\s*["']([^"']+)["']/);
    if (srcMatch && srcMatch[1]) {
      m3u8Url = srcMatch[1];
    } else {
      // Check packer
      const pMatch = embedRes.data.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?split\('\|'\)\)\)/);
      if (pMatch) {
        const u = eval(`(${pMatch[0].replace(/^eval/, "")})`);
        const lMatch = u.match(/links\s*=\s*(\{[\s\S]*?\});/);
        if (lMatch) {
          const links = JSON.parse(lMatch[1]);
          m3u8Url = links.hls2 || links.hls4 || links.hls3 || "";
        }
      }
    }

    console.log(`✓ 5. Resolved M3U8 Stream: ${m3u8Url}`);

    if (m3u8Url) {
      const streamRes = await axios.get(m3u8Url, {
        headers: { "User-Agent": "Mozilla/5.0", Referer: iframeSrc },
      });
      console.log(`✓ 6. M3U8 Playlist Buffer Test (Length: ${streamRes.data.length})`);
      console.log("Preview:\n" + streamRes.data.slice(0, 250));
    }
  }
}

runTest();
