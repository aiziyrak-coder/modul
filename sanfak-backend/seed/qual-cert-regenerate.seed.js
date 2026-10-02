"use strict";

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const PDF_DIR = path.join(__dirname, "../uploads/pdfs");

const mongoose = require("mongoose");

const DRY = process.argv.includes("--dry");
const ALLOW_LOCAL = process.argv.includes("--allow-localhost");
const baseArg = process.argv.find((a) => a.startsWith("--base="));
const BASE = (baseArg ? baseArg.slice("--base=".length) : process.env.PUBLIC_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");

function checkBase() {
  if (!BASE) {
    throw new Error(
      "baza manzili berilmagan. --base=https://... bering yoki PUBLIC_BASE_URL " +
        "env o'rnating (QR shu manzilga ishora qiladi).",
    );
  }
  if (!/^https?:\/\//.test(BASE)) {
    throw new Error(`--base noto'g'ri: "${BASE}" (http:// yoki https:// bilan boshlansin)`);
  }
  if (/localhost|127\.0\.0\.1/.test(BASE) && !ALLOW_LOCAL) {
    throw new Error(
      `--base localhost'ga ishora qilyapti ("${BASE}"). Bunday QR faqat shu ` +
        "mashinada ishlaydi. Ataylab bo'lsa --allow-localhost qo'shing.",
    );
  }
}

async function main() {
  checkBase();
  await mongoose.connect(process.env.MONGO_HOST);

  const {
    saveSertifikatPdf,
  } = require("../src/modules/4.04-qualification/_pdf/sertifikat.pdf");
  const {
    saveMalumotnomaPdf,
  } = require("../src/modules/4.04-qualification/_pdf/malumotnoma.pdf");
  const col = mongoose.connection.db.collection("qualearnedcertificates");

  const certs = await col
    .find({ kind: 1 })
    .sort({ regNumber: 1, createdAt: 1 })
    .toArray();
  const noReg = certs.filter((c) => !c.regNumber).length;

  console.log("[QualCertRegenerate] " + (DRY ? "DRY-RUN — fayl yozilmaydi" : "qo'llanmoqda"));
  console.log("  QR bazasi        :", BASE);
  console.log("  sertifikatlar    :", certs.length);
  if (noReg) {
    console.log(
      "  DIQQAT           : " + noReg + " tasida qayd raqami YO'Q — " +
        "avval `npm run seed:qual-cert-regnumber` ni ishlating, aks holda " +
        "blankada bu maydon bo'sh chiqadi",
    );
  }

  const failed = [];
  let done = 0;
  for (const c of certs) {
    const label =
      "tpl=" + (c.template || "-") + " seriya=" + (c.number || "-") +
      " qayd=" + (c.regNumber || "-");
    if (DRY) {
      console.log("   " + label + "  ->  (qayta yoziladi)");
      continue;
    }
    try {
      const url = await saveSertifikatPdf(c._id, BASE);
      console.log("   " + label + "  ->  " + url);
      done += 1;
    } catch (err) {
      console.log("   " + label + "  ->  XATO: " + err.message);
      failed.push({ id: String(c._id), message: err.message });
    }
  }

  console.log("  qayta yozildi    :", DRY ? 0 : done);

  const refs = await col.find({ kind: 2 }).sort({ createdAt: 1 }).toArray();
  console.log("  ma'lumotnomalar  :", refs.length);

  let refDone = 0;
  for (const c of refs) {
    const oldName = String(c.file || "").split("/").pop().split("?")[0];
    if (DRY) {
      console.log("   " + (c.number || "raqamsiz") + "  ->  (qayta yoziladi)");
      continue;
    }
    try {
      const url = await saveMalumotnomaPdf(c._id, BASE);
      if (oldName.startsWith("malumotnoma-")) {
        const p = path.join(PDF_DIR, oldName);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      console.log("   " + (c.number || "yangi") + "  ->  " + url);
      refDone += 1;
    } catch (err) {
      console.log("   " + String(c._id) + "  ->  XATO: " + err.message);
      failed.push({ id: String(c._id), message: err.message });
    }
  }
  console.log("  ma'lumotnoma PDF :", DRY ? 0 : refDone);

  const relative = await col
    .find({ file: { $type: "string", $regex: "^/" } })
    .toArray();
  if (relative.length) {
    console.log("  nisbiy havolalar :", relative.length);
    for (const c of relative) {
      const abs = BASE + c.file;
      console.log("   " + (c.number || "ma'lumotnoma") + "  ->  " + abs);
      if (!DRY) {
        await col.updateOne({ _id: c._id }, { $set: { file: abs } });
      }
    }
  } else {
    console.log("  nisbiy havolalar : yo'q");
  }
  if (failed.length) {
    console.log("  XATOLAR          :", failed.length);
    failed.forEach((f) => console.log("    " + f.id + " — " + f.message));
  }

  await mongoose.disconnect();
  if (failed.length) process.exitCode = 1;
}

module.exports = { checkBase };

if (require.main === module) {
  main().catch((err) => {
    console.error("[QualCertRegenerate] XATO:", err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}
