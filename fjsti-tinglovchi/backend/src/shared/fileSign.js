const crypto = require("crypto");

const PUBLIC_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]);

const TTL_SECONDS = Number(process.env.PROXY_FILE_URL_TTL_SECONDS) || 30 * 24 * 60 * 60;

let cachedSecret = null;
function getSecret() {
  if (cachedSecret) return cachedSecret;
  const raw = process.env.FILE_URL_SECRET || process.env.JWT_SECRET || "";
  cachedSecret = crypto.createHash("sha256").update(`file-url-signing:${raw}`).digest();
  return cachedSecret;
}

function computeSignature(relativePath, expiry) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(`${relativePath}:${expiry}`)
    .digest("hex")
    .slice(0, 32);
}

function signFileUrl(fileUrl) {
  if (!fileUrl || typeof fileUrl !== "string") return fileUrl;
  const marker = "/files/";
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) return fileUrl;

  if (/[?&]t=[^&]+/.test(fileUrl) && /[?&]e=\d+/.test(fileUrl)) return fileUrl;

  const relativePath = fileUrl.slice(idx + marker.length).split("?")[0];
  const dotIdx = relativePath.lastIndexOf(".");
  const ext = dotIdx === -1 ? "" : relativePath.slice(dotIdx).toLowerCase();
  if (PUBLIC_IMAGE_EXTENSIONS.has(ext)) return fileUrl;

  const expiry = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const t = computeSignature(relativePath, expiry);
  const sep = fileUrl.includes("?") ? "&" : "?";
  return `${fileUrl}${sep}t=${t}&e=${expiry}`;
}

function signFileUrlsDeep(value) {
  if (typeof value === "string") return signFileUrl(value);
  if (Array.isArray(value)) return value.map(signFileUrlsDeep);
  if (value && typeof value === "object") {
    for (const k of Object.keys(value)) value[k] = signFileUrlsDeep(value[k]);
    return value;
  }
  return value;
}

module.exports = { signFileUrl, signFileUrlsDeep };
