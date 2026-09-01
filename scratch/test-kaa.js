const axios = require("axios");

async function testKaa() {
  try {
    const res = await axios.get(
      "https://kaa.lt/api/show/one-piece/episode/ep-1-163f451f47",
      {
        headers: { "User-Agent": "Mozilla/5.0" },
      },
    );
    console.log("SERVERS:", res.data.servers);
    const srv = res.data.servers[0];
    const playerRes = await axios.get(srv.src, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://kaa.lt/" },
    });
    const cleanHtml = playerRes.data.replace(/&quot;/g, '"');
    const m = cleanHtml.match(/manifest":\[0,"(?:https?:)?(\/\/[^"]+)"/);
    if (m) {
      const manifestUrl = "https:" + m[1];
      console.log("MANIFEST URL:", manifestUrl);
      const m3u8Res = await axios.get(manifestUrl, {
        headers: {
          Origin: new URL(srv.src).origin,
          Referer: srv.src,
          "User-Agent": "Mozilla/5.0",
        },
      });
      console.log("M3U8 STATUS:", m3u8Res.status);
      console.log("M3U8 BODY:\n", m3u8Res.data.slice(0, 400));
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

testKaa();
