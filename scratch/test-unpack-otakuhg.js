const axios = require("axios");

function unpack(p, a, c, k, e, d) {
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp("\\b" + c.toString(a) + "\\b", "g"), k[c]);
    }
  }
  return p;
}

async function testOtakuHg() {
  const res = await axios.get("https://otakuhg.site/e/0w89yga387ho", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: "https://anidao.to/",
    },
  });

  const match = res.data.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?split\('\|'\)\)\)/);
  if (match) {
    const raw = match[0];
    const unpacked = eval(`(function() { return ${raw.replace(/^eval/, "")} })()`);
    console.log("UNPACKED STREAM SOURCES:");
    const fileMatches = unpacked.match(/sources:\s*\[[\s\S]*?\]/);
    console.log(fileMatches ? fileMatches[0] : unpacked.slice(0, 500));
  }
}

testOtakuHg();
