function unpackJs(packed) {
  // Regex to extract p, a, c, k from packed eval
  const match = packed.match(
    /eval\(function\(p,a,c,k,e,[rd]\)\s*\{[\s\S]*?\}\s*\((['"][\s\S]*?['"]),\s*(\d+),\s*(\d+),\s*(['"][\s\S]*?['"])\.split\('\|'\)/,
  );
  if (!match) return packed;

  let [, pRaw, aStr, cStr, kRaw] = match;
  let p = pRaw.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
  const a = parseInt(aStr, 10);
  let c = parseInt(cStr, 10);
  const k = kRaw.slice(1, -1).split("|");

  const e = (cNum) => {
    return (
      (cNum < a ? "" : e(Math.floor(cNum / a))) +
      (cNum % a > 35
        ? String.fromCharCode((cNum % a) + 29)
        : (cNum % a).toString(36))
    );
  };

  while (c--) {
    if (k[c]) {
      const reg = new RegExp("\\b" + e(c) + "\\b", "g");
      p = p.replace(reg, () => k[c]);
    }
  }
  return p;
}

const samplePacked = "eval(function(p,a,c,k,e,d){e=function(c){return(c<a?'':e(parseInt(c/a)))+((c=c%a)>35?String.fromCharCode(c+29):c.toString(36))};if(!''.replace(/^/,String)){while(c--)d[e(c)]=k[c]||e(c);k=[function(e){return d[e]}];e=function(){return'\\\\w+'};c=1};while(c--)if(k[c])p=p.replace(new RegExp('\\\\b'+e(c)+'\\\\b','g'),k[c]);return p}('0 1=\\'2://3.4/5.6\\';',7,7,'const|source|https|cdn.kwik|stream|master|m3u8'.split('|'),0,{}))";

console.log('Result:', unpackJs(samplePacked));
