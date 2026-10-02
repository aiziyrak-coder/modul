"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const SIGNATURES = [
  { bytes: [0x25, 0x50, 0x44, 0x46, 0x2d], mimeType: "application/pdf", ext: "pdf" },
  { bytes: [0xff, 0xd8, 0xff], mimeType: "image/jpeg", ext: "jpg" },
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mimeType: "image/png", ext: "png" },
];

function detectScanType(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  const hit = SIGNATURES.find(
    ({ bytes }) => buffer.length > bytes.length && bytes.every((b, i) => buffer[i] === b),
  );
  return hit ? { mimeType: hit.mimeType, ext: hit.ext } : null;
}

const configuredRoot = () =>
  process.env.RESIDENCY_EXPULSION_ORDER_FILES_DIR ||
  `${process.env.FILEPATH || "./"}private/residency-expulsion-orders`;

const within = (child, parent) =>
  child === parent || child.startsWith(parent.endsWith(path.sep) ? parent : parent + path.sep);

const publicRoots = () =>
  [
    path.join(REPO_ROOT, "uploads"),
    path.resolve(`${process.env.FILEPATH || "./"}uploads`),
    path.join(REPO_ROOT, "public", "build"),
  ].map((p) => path.resolve(p));

function realOrSelf(p) {
  const tail = [];
  let cur = p;
  while (!fs.existsSync(cur)) {
    const parent = path.dirname(cur);
    if (parent === cur) return p;
    tail.unshift(path.basename(cur));
    cur = parent;
  }
  try {
    return path.join(fs.realpathSync.native(cur), ...tail);
  } catch (err) {
    winston.warn(`[4.5 expulsionOrderFiles] realpath olinmadi ${cur}: ${err.message}`);
    return p;
  }
}

function resolveRoot() {
  const root = path.resolve(configuredRoot());
  const realRoot = realOrSelf(root);
  const inside = (pub) => within(root, pub) || within(realRoot, realOrSelf(pub));
  if (publicRoots().some(inside)) {
    winston.error(`[4.5 expulsionOrderFiles] skan ildizi statik papka ichida: ${root}`);
    throw new ErrorHandler(500, "Skan saqlash joyi noto'g'ri sozlangan", "scan_root_public", {
      reason: "scan_root_public",
    });
  }
  return root;
}

function resolveAbsolute(storageKey) {
  const root = resolveRoot();
  const abs = path.resolve(root, String(storageKey || ""));
  if (abs === root || !within(abs, root)) throw new Error(`Yaroqsiz storageKey: ${storageKey}`);
  return abs;
}

const buildStorageKey = (ext, now = new Date(), prefix = "") => {
  if (prefix && !/^[a-z]+$/.test(prefix)) throw new Error(`Yaroqsiz prefix: ${prefix}`);
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${prefix ? `${prefix}/` : ""}${yyyy}/${mm}/${uuidv4()}.${ext}`;
};

async function save(buffer, ext, { prefix = "" } = {}) {
  const storageKey = buildStorageKey(ext, new Date(), prefix);
  const abs = resolveAbsolute(storageKey);
  await fsp.mkdir(path.dirname(abs), { recursive: true });
  await fsp.writeFile(abs, buffer, { flag: "wx" });
  return {
    storageKey,
    size: buffer.length,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
  };
}

async function stat(storageKey) {
  try {
    return await fsp.stat(resolveAbsolute(storageKey));
  } catch (err) {
    if (err.code === "ENOENT" || err.code === "ENOTDIR") return null;
    throw err;
  }
}

async function readFile(storageKey) {
  try {
    return await fsp.readFile(resolveAbsolute(storageKey));
  } catch (err) {
    if (err.code === "ENOENT" || err.code === "ENOTDIR") return null;
    throw err;
  }
}

const createReadStream = (storageKey) => fs.createReadStream(resolveAbsolute(storageKey));

async function remove(storageKey) {
  try {
    await fsp.unlink(resolveAbsolute(storageKey));
  } catch (err) {
    winston.warn(`[4.5 expulsionOrderFiles] yetim fayl o'chirilmadi ${storageKey}: ${err.message}`);
  }
}

module.exports = {
  detectScanType,
  resolveRoot,
  resolveAbsolute,
  buildStorageKey,
  save,
  stat,
  readFile,
  createReadStream,
  remove,
};
