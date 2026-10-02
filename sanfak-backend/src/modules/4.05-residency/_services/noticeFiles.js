"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

const resolveRoot = () =>
  process.env.RESIDENCY_NOTICE_FILES_DIR ||
  `${process.env.FILEPATH || "./"}uploads/residency-notices`;

const buildStorageKey = () => {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${yyyy}/${mm}/${uuidv4()}.pdf`;
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

async function save(buffer) {
  const storageKey = buildStorageKey();
  const abs = resolveAbsolute(storageKey);
  await fsp.mkdir(path.dirname(abs), { recursive: true });
  await fsp.writeFile(abs, buffer);
  return {
    storageKey,
    size: buffer.length,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
  };
}

const createReadStream = (storageKey) =>
  fs.createReadStream(resolveAbsolute(storageKey));

async function stat(storageKey) {
  try {
    return await fsp.stat(resolveAbsolute(storageKey));
  } catch {
    return null;
  }
}

module.exports = { resolveRoot, resolveAbsolute, buildStorageKey, save, createReadStream, stat };
