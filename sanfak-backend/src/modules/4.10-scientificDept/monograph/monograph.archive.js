const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const Monograph = require("./monograph.model");

const UPLOADS_ROOT = path.join(__dirname, "../../../../uploads");

const SLOT_LABELS = {
  referral: "Yo'llanma xat",
  council: "Ilmiy kengash qaroridan ko'chirma",
  file: "Monografiya fayli",
  passport: "Pasport qismi",
  titul: "Titul",
  external: "Tashqi taqriz",
  internal: "Ichki taqriz",
  antiplagiat: "Antiplagiat hisoboti",
  ziyonet: "Ziyonet ma'lumotnomasi",
};

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

async function streamMonographArchive(doc, res) {
  const files = doc.files || {};

  const entries = [];
  for (const slot of Monograph.MONOGRAPH_FILE_SLOTS) {
    const abs = urlToDiskPath(files[slot]);
    if (!abs || !fs.existsSync(abs)) continue;
    const ext = path.extname(abs) || "";
    entries.push({ abs, name: `${safeName(SLOT_LABELS[slot] || slot)}${ext}` });
  }

  if (!entries.length) {
    throw new ErrorHandler(404, "Yuklab olish uchun fayl topilmadi");
  }

  const archive = archiver("zip", { zlib: { level: 6 } });

  const zipName = `${safeName(doc.title || "monografiya")}.zip`;
  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="monograph.zip"; filename*=UTF-8''${encodeURIComponent(zipName)}`,
  );

  archive.on("error", (err) => {
    winston.error(`[monograph.archive] xato: ${err.message}`);
    res.destroy(err);
  });
  archive.on("warning", (err) => {
    if (err.code !== "ENOENT") winston.warn(`[monograph.archive] ogohlantirish: ${err.message}`);
  });

  archive.pipe(res);
  entries.forEach((e) => archive.file(e.abs, { name: e.name }));
  await archive.finalize();
}

module.exports = { streamMonographArchive, urlToDiskPath, SLOT_LABELS };
