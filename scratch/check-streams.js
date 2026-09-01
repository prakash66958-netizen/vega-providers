const axios = require("axios");

async function checkStreams() {
  const masterUrl = "https://morning-credit-3bcc.vibevibe.workers.dev/agde35b73cc6da4f161af6a5d8f93ba1ce4h/master.m3u8";
  const p1 = await axios.get(masterUrl);
  console.log("Master 1 (Vibe):", p1.status, p1.data.length);

  const otakuMaster = "https://JdeVcHPXBGC6.premilkyway.com/hls2/01/14852/0w89yga387ho_,l,n,h,.urlset/master.m3u8?t=bMG3Uu2xzGQdIU7fGXJv0Rg5Y7aXsNj3aCCP5xZ3Djo&s=1788284321&e=129600&f=74260313&srv=zfrDFVBCJYdZ54KZ&i=0.4&sp=500&p1=zfrDFVBCJYdZ54KZ&p2=zfrDFVBCJYdZ54KZ&asn=24560";
  try {
    const p2 = await axios.get(otakuMaster, { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://otakuhg.site/" } });
    console.log("Master 2 (Otaku):", p2.status, p2.data.length);
  } catch (e) {
    console.log("Master 2 err:", e.message);
  }
}

checkStreams();
