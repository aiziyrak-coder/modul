"use strict";

const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const { EJSON } = require("bson");

const ENV_PATH = path.join(__dirname, "..", "..", ".env");
const DEFAULT_BACKUP_DIR = path.join(__dirname, "prod-fix-backups");

async function connectDb(mongoUriOverride) {
  require("dotenv").config({ path: ENV_PATH });
  const uri = mongoUriOverride || process.env.MONGO_HOST;
  if (!uri) {
    throw new Error("MONGO_HOST topilmadi (.env) va --mongo berilmagan — ulanib bo'lmadi.");
  }
  await mongoose.connect(uri);
  return {
    mongoose,
    db: mongoose.connection.db,
    dbName: mongoose.connection.name,
  };
}

function parseObjectIdString(v) {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!/^[a-f0-9]{24}$/i.test(t)) return null;
  return new mongoose.Types.ObjectId(t);
}

function nextBackupNumber(existingFilenames, scriptName) {
  const re = new RegExp(`^${scriptName}-(\\d+)\\.json$`);
  let max = 0;
  for (const f of existingFilenames) {
    const m = re.exec(f);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

const BACKUP_FORMAT = 2;

function writeBackup(backupDir, scriptName, payload) {
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const existing = fs.readdirSync(backupDir);
  const n = nextBackupNumber(existing, scriptName);
  const file = path.join(backupDir, `${scriptName}-${n}.json`);
  const body = { backupFormat: BACKUP_FORMAT, ...payload };
  fs.writeFileSync(file, EJSON.stringify(body, undefined, 2, { relaxed: false }), "utf8");
  return file;
}

function readBackup(file) {
  const raw = fs.readFileSync(file, "utf8");
  const payload = EJSON.parse(raw, { relaxed: false });
  const format = Number(payload.backupFormat) || 1;
  return { format, payload };
}

const log = (s = "") => console.log(s);
const line = (c = "─", n = 78) => console.log(c.repeat(n));

module.exports = {
  ENV_PATH,
  DEFAULT_BACKUP_DIR,
  BACKUP_FORMAT,
  connectDb,
  parseObjectIdString,
  nextBackupNumber,
  writeBackup,
  readBackup,
  log,
  line,
};
