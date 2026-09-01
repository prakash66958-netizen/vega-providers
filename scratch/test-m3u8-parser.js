const axios = require("axios");

async function parseMasterPlaylist(masterUrl, origin) {
  const res = await axios.get(masterUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  const lines = res.data.split("\n");
  const streams = [];

  // Add the Master HLS stream first
  streams.push({
    server: "AniDao (Auto / Adaptive HLS)",
    link: masterUrl,
    type: "m3u8",
  });

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("#EXT-X-STREAM-INF:")) {
      const nextLine = lines[i + 1] ? lines[i + 1].trim() : "";
      if (nextLine && !nextLine.startsWith("#")) {
        const fullUrl = new URL(nextLine, masterUrl).href;
        let quality = "1080";
        if (line.includes("1920x1080") || line.includes('1080p"') || line.includes("1080")) {
          quality = "1080";
        } else if (line.includes("1280x720") || line.includes('720p"') || line.includes("720")) {
          quality = "720";
        } else if (line.includes("640x360") || line.includes('360p"') || line.includes("360")) {
          quality = "360";
        }

        streams.push({
          server: `AniDao ${quality}p`,
          link: fullUrl,
          type: "m3u8",
          quality: quality,
        });
      }
    }
  }

  return streams;
}

async function test() {
  const masterUrl = "https://vivibebe.site/public/stream/b9376d884c9836ac/master.m3u8";
  const streams = await parseMasterPlaylist(masterUrl, "https://vivibebe.site");
  console.log("PARSED STREAMS:", streams);

  for (const s of streams) {
    const check = await axios.get(s.link, { headers: { "User-Agent": "Mozilla/5.0" } });
    console.log(`✓ [${check.status}] ${s.server} -> ${s.link}`);
  }
}

test();
