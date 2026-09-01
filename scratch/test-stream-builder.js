const axios = require("axios");

async function buildStreams(masterUrl) {
  const streams = [];

  // 1. Master Auto Stream (ExoPlayer's preferred format)
  streams.push({
    server: "AniDao (Auto / 1080p)",
    link: masterUrl,
    type: "m3u8",
    quality: "1080",
  });

  // 2. Parse child playlists
  try {
    const res = await axios.get(masterUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const lines = res.data.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("#EXT-X-STREAM-INF:")) {
        const next = lines[i + 1] ? lines[i + 1].trim() : "";
        if (next && !next.startsWith("#")) {
          const full = new URL(next, masterUrl).href;
          let q = "1080";
          if (line.includes("1080")) q = "1080";
          else if (line.includes("720")) q = "720";
          else if (line.includes("480")) q = "480";
          else if (line.includes("360")) q = "360";

          streams.push({
            server: `AniDao ${q}p`,
            link: full,
            type: "m3u8",
            quality: q,
          });
        }
      }
    }
  } catch {}

  return streams;
}

async function run() {
  const res = await buildStreams("https://morning-credit-3bcc.vibevibe.workers.dev/agde35b73cc6da4f161af6a5d8f93ba1ce4h/master.m3u8");
  console.log("BUILT STREAMS:", res);
}

run();
