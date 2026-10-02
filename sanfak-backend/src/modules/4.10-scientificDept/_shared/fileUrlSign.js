const { appendSignature } = require("#shared/fileAccess");

function stripSignature(url) {
  const i = url.indexOf("?");
  if (i === -1) return url;
  const params = new URLSearchParams(url.slice(i + 1));
  params.delete("t");
  params.delete("e");
  const rest = params.toString();
  return rest ? `${url.slice(0, i)}?${rest}` : url.slice(0, i);
}

function resignUrl(url) {
  if (!url || typeof url !== "string") return url;
  return appendSignature(stripSignature(url));
}

function resignDeep(value) {
  if (typeof value === "string") return resignUrl(value);
  if (Array.isArray(value)) return value.map(resignDeep);
  if (value && typeof value === "object" && value.constructor === Object) {
    const out = {};
    Object.entries(value).forEach(([k, v]) => {
      out[k] = resignDeep(v);
    });
    return out;
  }
  return value;
}

function resignDocFiles(doc, fields = ["fileUrl"]) {
  if (!doc) return doc;
  let out = doc;
  fields.forEach((f) => {
    const v = out[f];
    if (v === undefined || v === null || v === "") return;
    if (out === doc) out = { ...doc };
    out[f] = resignDeep(v);
  });
  return out;
}

function fileResigner(fields) {
  const one = (doc) => resignDocFiles(doc, fields);
  return (input) => (Array.isArray(input) ? input.map(one) : one(input));
}

module.exports = { stripSignature, resignUrl, resignDeep, resignDocFiles, fileResigner };
