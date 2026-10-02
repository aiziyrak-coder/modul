"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const WRITE = process.argv.includes("--write");
const DRY = !WRITE;

(async () => {
  const uri = process.env.MONGO_HOST;
  if (!uri) {
    console.error("XATO: MONGO_HOST topilmadi (.env)");
    process.exit(1);
  }
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  console.log(
    `REJIM: ${WRITE ? "YOZISH (--write)" : "DRY (yozilmaydi)"}  ·  baza: ${mongoose.connection.name}\n`,
  );

  const candidates = await db
    .collection("users")
    .find({
      department: { $ne: null, $exists: true },
      $or: [{ faculty: null }, { faculty: { $exists: false } }],
    })
    .project({ _id: 1, firstName: 1, lastName: 1, oneIdPin: 1, department: 1 })
    .toArray();

  const totalUsers = await db.collection("users").countDocuments({});
  const noDepartment = await db.collection("users").countDocuments({
    $and: [
      { $or: [{ department: null }, { department: { $exists: false } }] },
      { $or: [{ faculty: null }, { faculty: { $exists: false } }] },
    ],
  });

  console.log(`users jami                                      : ${totalUsers}`);
  console.log(`  faculty bo'sh + department BOR (nomzod)       : ${candidates.length}`);
  console.log(`  faculty bo'sh + department ham YO'Q (tegilmaydi): ${noDepartment}\n`);

  if (!candidates.length) {
    console.log("Hech narsa to'ldirilmaydi — bo'shliq yo'q.\n");
    await mongoose.disconnect();
    return;
  }

  const deptIds = [...new Set(candidates.map((u) => String(u.department)))];
  const departments = await db
    .collection("departments")
    .find({ _id: { $in: deptIds.map((id) => new mongoose.Types.ObjectId(id)) } })
    .project({ _id: 1, title: 1, faculty: 1 })
    .toArray();
  const deptById = new Map(departments.map((d) => [String(d._id), d]));

  let updated = 0;
  let deptMissing = 0;
  let deptNoParent = 0;

  for (const u of candidates) {
    const nom = `${u.lastName || ""} ${u.firstName || ""}`.trim() || "(nomsiz)";
    const pin = String(u.oneIdPin || "—").padEnd(15);
    const dept = deptById.get(String(u.department));

    if (!dept) {
      console.log(
        `  ⊘ TEGILMADI ${pin} ${nom.padEnd(26)} — kafedra hujjati topilmadi (${u.department})`,
      );
      deptMissing += 1;
      continue;
    }
    if (!dept.faculty) {
      console.log(
        `  ⊘ TEGILMADI ${pin} ${nom.padEnd(26)} — "${dept.title}" kafedrasida parent (faculty) yo'q`,
      );
      deptNoParent += 1;
      continue;
    }

    console.log(
      `  ✍ ${DRY ? "YOZILARDI" : "YOZILDI  "} ${pin} ${nom.padEnd(26)} — ` +
        `${dept.title} → faculty ${dept.faculty}`,
    );
    if (!DRY) {
      await db
        .collection("users")
        .updateOne({ _id: u._id }, { $set: { faculty: dept.faculty } });
    }
    updated += 1;
  }

  console.log(
    `\nXULOSA: ${DRY ? "yangilanardi" : "yangilandi"}=${updated}  ` +
      `kafedra topilmadi=${deptMissing}  kafedrada parent yo'q=${deptNoParent}`,
  );
  if (DRY && updated > 0) {
    console.log(
      "Yozish uchun `--write` bilan qayta ishga tushiring (avval zaxira!).",
    );
  }
  console.log("");

  await mongoose.disconnect();
})().catch(async (e) => {
  console.error("XATO:", e.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
