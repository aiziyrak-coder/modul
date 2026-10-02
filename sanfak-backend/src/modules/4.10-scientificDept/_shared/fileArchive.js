const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");

const UPLOADS_ROOT = path.join(__dirname, "../../../../uploads");

const safeName = (s) =>
  String(s || "hujjat")
    .replace(/[\\/:*?"<>|\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

function urlToDiskPath(fileUrl) {
  if (!fileUrl || typeof fileUrl !== "string") return null;
  const marker = "/files/";
  const i = fileUrl.indexOf(marker);
  if (i === -1) return null;

  const rel = decodeURIComponent(fileUrl.slice(i + marker.length).split("?")[0]);
  if (!rel || rel.includes("..")) return null;

  const abs = path.resolve(UPLOADS_ROOT, rel);
  if (!abs.startsWith(path.resolve(UPLOADS_ROOT))) return null;
  return abs;
}

function collectEntries(files = {}, slots = [], labels = {}) {
  const entries = [];
  slots.forEach((slot) => {
    const abs = urlToDiskPath(files[slot]);
    if (!abs || !fs.existsSync(abs)) return;
    const ext = path.extname(abs) || "";
    entries.push({ abs, name: `${safeName(labels[slot] || slot)}${ext}` });
  });
  return entries;
}

async function streamArchive(entries, zipBaseName, res) {
  if (!entries.length) {
    throw new ErrorHandler(404, "Yuklab olish uchun fayl topilmadi");
  }

  const archive = archiver("zip", { zlib: { level: 6 } });

  const zipName = `${safeName(zipBaseName)}.zip`;
  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="archive.zip"; filename*=UTF-8''${encodeURIComponent(zipName)}`,
  );

  archive.on("error", (err) => {
    winston.error(`[fileArchive] xato: ${err.message}`);
    res.destroy(err);
  });
  archive.on("warning", (err) => {
    if (err.code !== "ENOENT") winston.warn(`[fileArchive] ogohlantirish: ${err.message}`);
  });

  archive.pipe(res);
  entries.forEach((e) => archive.file(e.abs, { name: e.name }));
  await archive.finalize();
}

module.exports = { UPLOADS_ROOT, safeName, urlToDiskPath, collectEntries, streamArchive };
