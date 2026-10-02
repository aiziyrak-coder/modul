"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const DRY_FLAG = process.argv.includes("--dry");
const WRITE = process.argv.includes("--write") && !DRY_FLAG;
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

  const profiles = await db
    .collection("teacherprofiles")
    .find({})
    .project({ _id: 1, user: 1, position: 1, hrApprovalStatus: 1 })
    .toArray();

  const approved = profiles.filter((p) => p.hrApprovalStatus === "approved");
  const notApproved = profiles.filter((p) => p.hrApprovalStatus !== "approved");

  const totalUsers = await db.collection("users").countDocuments({});
  console.log(`users jami                                        : ${totalUsers}`);
  console.log(`teacherprofiles jami                              : ${profiles.length}`);
  console.log(`  approved (nomzod)                               : ${approved.length}`);
  console.log(
    `  pending/rejected (tegilmaydi)                   : ${notApproved.length}`,
  );
  console.log(
    `  profili YO'Q userlar (tegilmaydi)               : ${totalUsers - profiles.length}\n`,
  );

  if (!approved.length) {
    console.log("Tasdiqlangan profil yo'q — hech narsa sinxronlanmaydi.\n");
    await mongoose.disconnect();
    return;
  }

  const userIds = [
    ...new Set(approved.filter((p) => p.user).map((p) => String(p.user))),
  ];
  const users = await db
    .collection("users")
    .find({ _id: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) } })
    .project({ _id: 1, firstName: 1, lastName: 1, oneIdPin: 1, position: 1 })
    .toArray();
  const userById = new Map(users.map((u) => [String(u._id), u]));

  const positions = await db
    .collection("positions")
    .find({})
    .project({ _id: 1, title: 1 })
    .toArray();
  const positionTitle = (id) =>
    (positions.find((p) => String(p._id) === String(id)) || {}).title || "—";

  let updated = 0;
  let alreadyOk = 0;
  let noProfilePosition = 0;
  let userMissing = 0;

  for (const p of approved) {
    const u = p.user ? userById.get(String(p.user)) : null;
    const nom = u
      ? `${u.lastName || ""} ${u.firstName || ""}`.trim() || "(nomsiz)"
      : "(user topilmadi)";
    const pin = String(u?.oneIdPin || "—").padEnd(15);

    if (!u) {
      console.log(
        `  ⊘ TEGILMADI ${pin} ${nom.padEnd(26)} — profil ${p._id} ning user havolasi uzilgan`,
      );
      userMissing += 1;
      continue;
    }
    if (!p.position) {
      console.log(
        `  ⊘ TEGILMADI ${pin} ${nom.padEnd(26)} — profilda lavozim yo'q ` +
          `(users.position = "${positionTitle(u.position)}" BO'SHATILMAYDI)`,
      );
      noProfilePosition += 1;
      continue;
    }
    if (String(u.position || "") === String(p.position)) {
      alreadyOk += 1;
      continue;
    }

    console.log(
      `  ✍ ${DRY ? "YOZILARDI" : "YOZILDI  "} ${pin} ${nom.padEnd(26)} — ` +
        `"${positionTitle(u.position)}" → "${positionTitle(p.position)}" (${p.position})`,
    );
    if (DRY) {
      updated += 1;
    } else {
      await db
        .collection("users")
        .updateOne({ _id: u._id }, { $set: { position: p.position } });
      updated += 1;
    }
  }

  console.log(
    `\nXULOSA: ${DRY ? "yangilanardi" : "yangilandi"}=${updated}  ` +
      `allaqachon mos=${alreadyOk}  profilda lavozim yo'q=${noProfilePosition}  ` +
      `user havolasi uzilgan=${userMissing}  pending/rejected=${notApproved.length}`,
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
