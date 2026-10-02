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

function looksLikeFileUrl(s) {
  if (s.length > 2048 || /\s/.test(s)) return false;
  const i = s.indexOf("/files/");
  if (i === -1) return false;
  return i === 0 || /^https?:\/\//i.test(s);
}

function resignUrl(url) {
  if (!url || typeof url !== "string") return url;
  if (!looksLikeFileUrl(url)) return url;
  return appendSignature(stripSignature(url));
}

function resignDeep(value) {
  if (typeof value === "string") return resignUrl(value);
  if (Array.isArray(value)) return value.map(resignDeep);
  if (value && typeof value === "object") {
    const out = {};
    Object.entries(value).forEach(([k, v]) => {
      out[k] = resignDeep(v);
    });
    return out;
  }
  return value;
}

function signFileUrls(req, res, next) {
  const send = res.json.bind(res);
  res.json = (body) => {
    let raw;
    try {
      raw = JSON.stringify(body);
    } catch {
      return send(body);
    }
    if (!raw || !raw.includes("/files/")) return send(body);
    return send(resignDeep(JSON.parse(raw)));
  };
  return next();
}

module.exports = signFileUrls;
module.exports.stripSignature = stripSignature;
module.exports.resignUrl = resignUrl;
module.exports.looksLikeFileUrl = looksLikeFileUrl;
module.exports.resignDeep = resignDeep;
