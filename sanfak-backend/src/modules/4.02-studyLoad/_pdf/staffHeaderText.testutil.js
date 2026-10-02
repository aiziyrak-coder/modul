"use strict";

const zlib = require("zlib");

const docToBuffer = (doc) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });

function parseObjects(buf) {
  const s = buf.toString("latin1");
  const objs = new Map();
  const re = /(\d+) 0 obj([\s\S]*?)endobj/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const num = Number(m[1]);
    const body = m[2];
    const sIdx = body.indexOf("stream");
    let dict = body;
    let stream = null;
    if (sIdx !== -1) {
      dict = body.slice(0, sIdx);
      const start =
        m.index + m[1].length + " 0 obj".length + sIdx + "stream".length;
      const rel = body.indexOf("endstream", sIdx);
      let from = start;
      if (s[from] === "\r") from++;
      if (s[from] === "\n") from++;
      const to = m.index + m[1].length + " 0 obj".length + rel;
      stream = buf.slice(from, to);
    }
    objs.set(num, { dict, stream });
  }
  return objs;
}

const inflate = (o) => {
  if (!o || !o.stream) return null;
  if (!/FlateDecode/.test(o.dict)) return o.stream;
  try {
    return zlib.inflateSync(o.stream);
  } catch {
    return null;
  }
};

function parseCMap(text) {
  const map = new Map();
  const charRe = /beginbfchar([\s\S]*?)endbfchar/g;
  let m;
  while ((m = charRe.exec(text)) !== null) {
    const pairRe = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
    let p;
    while ((p = pairRe.exec(m[1])) !== null) {
      map.set(p[1].toLowerCase(), hexToStr(p[2]));
    }
  }
  const rangeRe = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((m = rangeRe.exec(text)) !== null) {
    let body = m[1];
    const arrRe = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([^\]]*)\]/g;
    let a;
    while ((a = arrRe.exec(body)) !== null) {
      const lo = parseInt(a[1], 16);
      const items = a[3].match(/<([0-9a-fA-F]+)>/g) || [];
      items.forEach((it, i) => {
        map.set(
          (lo + i).toString(16).padStart(4, "0"),
          hexToStr(it.slice(1, -1)),
        );
      });
    }
    body = body.replace(arrRe, " ");
    const rowRe = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
    let r;
    while ((r = rowRe.exec(body)) !== null) {
      const lo = parseInt(r[1], 16);
      const hi = parseInt(r[2], 16);
      const dst = parseInt(r[3], 16);
      for (let c = lo; c <= hi; c++) {
        map.set(c.toString(16).padStart(4, "0"), String.fromCharCode(dst + (c - lo)));
      }
    }
  }
  return map;
}

const hexToStr = (hex) => {
  let out = "";
  for (let i = 0; i + 3 < hex.length + 1; i += 4) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  }
  return out;
};

function extractPdfLines(buf) {
  const objs = parseObjects(buf);

  const fontMaps = new Map();
  for (const [num, o] of objs) {
    if (!/\/Type\s*\/Font/.test(o.dict)) continue;
    const tu = /\/ToUnicode\s+(\d+)\s+0\s+R/.exec(o.dict);
    if (!tu) continue;
    const cmapBuf = inflate(objs.get(Number(tu[1])));
    if (cmapBuf) fontMaps.set(num, parseCMap(cmapBuf.toString("latin1")));
  }

  const lines = [];
  for (const [, page] of objs) {
    if (!/\/Type\s*\/Page[^s]/.test(page.dict)) continue;
    const contentsRef = /\/Contents\s+(\d+)\s+0\s+R/.exec(page.dict);
    if (!contentsRef) continue;

    const resRef = /\/Resources\s+(\d+)\s+0\s+R/.exec(page.dict);
    const resDict = resRef ? objs.get(Number(resRef[1]))?.dict || "" : page.dict;

    const nameToFont = new Map();
    const fr = /\/Font\s*<<([^>]*)>>/.exec(resDict);
    if (fr) {
      const re = /\/(F\d+)\s+(\d+)\s+0\s+R/g;
      let m;
      while ((m = re.exec(fr[1])) !== null) nameToFont.set(m[1], Number(m[2]));
    }

    const content = inflate(objs.get(Number(contentsRef[1])));
    if (!content) continue;
    const text = content.toString("latin1");

    let cur = null;
    const tokRe = /\/(F\d+)\s+[\d.]+\s+Tf|\[([^\]]*)\]\s*TJ|<([0-9a-fA-F]+)>\s*Tj/g;
    let t;
    while ((t = tokRe.exec(text)) !== null) {
      if (t[1]) {
        cur = fontMaps.get(nameToFont.get(t[1])) || null;
        continue;
      }
      if (!cur) continue;
      const hexes = [];
      if (t[2] !== undefined) {
        const hr = /<([0-9a-fA-F]+)>/g;
        let h;
        while ((h = hr.exec(t[2])) !== null) hexes.push(h[1]);
      } else {
        hexes.push(t[3]);
      }
      let line = "";
      for (const hex of hexes) {
        for (let i = 0; i + 4 <= hex.length; i += 4) {
          line += cur.get(hex.slice(i, i + 4).toLowerCase()) ?? "";
        }
      }
      if (line.trim()) lines.push(line);
    }
  }
  return lines;
}

module.exports = { docToBuffer, extractPdfLines };
