"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const winston = require("#shared/winston.logger");

const resolveRoot = () =>
  process.env.RESIDENCY_ANNOUNCEMENT_FILES_DIR ||
  `${process.env.FILEPATH || "./"}uploads/residency-announcements`;

const resolveTmpRoot = () => path.join(resolveRoot(), ".tmp");

const TMP_TTL_MS =
  Number(process.env.RESIDENCY_ANNOUNCEMENT_TMP_TTL_MIN || 60) * 60 * 1000;
const TMP_SWEEP_INTERVAL_MS =
  Number(process.env.RESIDENCY_ANNOUNCEMENT_TMP_SWEEP_MIN || 60) * 60 * 1000;

const ILLEGAL_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;
const MAX_NAME_LENGTH = 200;

const sanitizeFilename = (original, ext) => {
  let name = String(original || "");

  name = name.split(/[/\\]/).pop() || "";

  name = name
    .normalize("NFC")
    .replace(ILLEGAL_CHARS, "")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+/, "")
    .trim();

  const lower = name.toLowerCase();
  if (ext && lower.endsWith(ext)) name = name.slice(0, -ext.length);

  name = name.replace(/[.\s]+$/, "").trim();
  if (!name) name = "fayl";
  if (name.length > MAX_NAME_LENGTH) name = name.slice(0, MAX_NAME_LENGTH).trim();

  return `${name}${ext || ""}`;
};

const buildStorageKey = (ext) => {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${yyyy}/${mm}/${uuidv4()}${ext || ""}`;
};

const resolveAbsolute = (storageKey) => {
  const root = path.resolve(resolveRoot());
  const abs = path.resolve(root, String(storageKey || ""));
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (abs !== root && !abs.startsWith(rootWithSep)) {
    throw new Error(`Yaroqsiz storageKey: ${storageKey}`);
  }
  return abs;
};

const createTmpPath = () => path.join(resolveTmpRoot(), `${uuidv4()}.part`);

const ensureDir = async (dir) => {
  await fsp.mkdir(dir, { recursive: true });
};

const ensureTmpDir = () => ensureDir(resolveTmpRoot());

const inspect = (tmpPath, headerBytes = 4096) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const chunks = [];
    let collected = 0;
    let size = 0;

    const stream = fs.createReadStream(tmpPath);
    stream.on("error", reject);
    stream.on("data", (chunk) => {
      hash.update(chunk);
      size += chunk.length;
      if (collected < headerBytes) {
        const need = headerBytes - collected;
        const slice = chunk.length > need ? chunk.subarray(0, need) : chunk;
        chunks.push(slice);
        collected += slice.length;
      }
    });
    stream.on("end", () =>
      resolve({
        checksum: hash.digest("hex"),
        header: Buffer.concat(chunks),
        size,
      }),
    );
  });

const scan = async (tmpPath) => ({ clean: true });

const commit = async (tmpPath, storageKey) => {
  const abs = resolveAbsolute(storageKey);
  await ensureDir(path.dirname(abs));
  try {
    await fsp.rename(tmpPath, abs);
  } catch (err) {
    if (err.code !== "EXDEV") throw err;
    await fsp.copyFile(tmpPath, abs);
    await fsp.unlink(tmpPath);
  }
  return abs;
};

const stat = async (storageKey) => {
  try {
    return await fsp.stat(resolveAbsolute(storageKey));
  } catch {
    return null;
  }
};

const createReadStream = (storageKey) =>
  fs.createReadStream(resolveAbsolute(storageKey));

const remove = async (storageKey) => {
  let abs;
  try {
    abs = resolveAbsolute(storageKey);
  } catch (err) {
    winston.error(`[announcementFiles] yaroqsiz storageKey: ${err.message}`);
    return false;
  }
  try {
    await fsp.unlink(abs);
    return true;
  } catch (err) {
    if (err.code === "ENOENT") return true;
    winston.error(
      `[announcementFiles] blob o'chirilmadi (${storageKey}): ${err.message}`,
    );
    return false;
  }
};

const removeMany = async (storageKeys = []) => {
  const results = await Promise.all(storageKeys.map(remove));
  return results.filter(Boolean).length;
};

const discard = async (tmpPath) => {
  if (!tmpPath) return;
  try {
    await fsp.unlink(tmpPath);
  } catch (err) {
    if (err.code !== "ENOENT") {
      winston.warn(
        `[announcementFiles] tmp fayl tozalanmadi (${tmpPath}): ${err.message}`,
      );
    }
  }
};

const discardMany = async (tmpPaths = []) => {
  await Promise.all(tmpPaths.map(discard));
};

const sweepTmp = async (maxAgeMs = TMP_TTL_MS) => {
  const dir = resolveTmpRoot();
  let entries;
  try {
    entries = await fsp.readdir(dir);
  } catch (err) {
    if (err.code !== "ENOENT") {
      winston.warn(`[announcementFiles] .tmp o'qilmadi: ${err.message}`);
    }
    return 0;
  }

  const cutoff = Date.now() - maxAgeMs;
  let swept = 0;
  let bytes = 0;
  for (const name of entries) {
    if (!name.endsWith(".part")) continue;
    const abs = path.join(dir, name);
    try {
      const info = await fsp.stat(abs);
      if (info.mtimeMs > cutoff) continue;
      await fsp.unlink(abs);
      swept += 1;
      bytes += info.size;
    } catch (err) {
      if (err.code !== "ENOENT") {
        winston.warn(
          `[announcementFiles] yetim tmp o'chmadi (${name}): ${err.message}`,
        );
      }
    }
  }
  if (swept) {
    winston.info(
      `[announcementFiles] ${swept} ta yetim .tmp fayl supurildi (${(bytes / 1048576).toFixed(1)} MB)`,
    );
  }
  return swept;
};

let sweepTimer = null;
const startTmpSweeper = (intervalMs = TMP_SWEEP_INTERVAL_MS) => {
  if (sweepTimer) return sweepTimer;
  sweepTmp().catch((err) =>
    winston.warn(`[announcementFiles] boshlang'ich supurish: ${err.message}`),
  );
  sweepTimer = setInterval(() => {
    sweepTmp().catch((err) =>
      winston.warn(`[announcementFiles] davriy supurish: ${err.message}`),
    );
  }, intervalMs);
  if (typeof sweepTimer.unref === "function") sweepTimer.unref();
  return sweepTimer;
};

const stopTmpSweeper = () => {
  if (sweepTimer) clearInterval(sweepTimer);
  sweepTimer = null;
};

module.exports = {
  resolveRoot,
  resolveTmpRoot,
  resolveAbsolute,
  sanitizeFilename,
  buildStorageKey,
  createTmpPath,
  ensureTmpDir,
  inspect,
  scan,
  commit,
  stat,
  createReadStream,
  remove,
  removeMany,
  discard,
  discardMany,
  sweepTmp,
  startTmpSweeper,
  stopTmpSweeper,
};
