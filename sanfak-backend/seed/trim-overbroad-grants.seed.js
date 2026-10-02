"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const WRITE = process.argv.includes("--write");
const log = (msg = "") => process.stdout.write(`${msg}\n`);

const WRITE_ACTIONS = ["create", "update", "delete", "approve", "reject", "export"];

const PLAN = [
  {
    role: "talaba",
    reason: "talaba institut e'lonini YARATA olardi",
    dropActions: {
      announcement: ["create"],
      student: ["create"],
      exam: ["create"],
      gradebook: ["create"],
      schedule: ["create"],
    },
  },
  {
    role: "magistratura_bolim",
    reason: "4.5 o'z `residencyAnnouncement` ini ishlatadi; `dissertation` marshrutsiz",
    dropSections: ["announcement", "dissertation"],
    dropActions: {
      resident: ["approve", "reject"],
      residentApplication: ["export"],
      residentAttendance: ["export", "reject"],
      residentDailyLog: ["export", "reject"],
      residentAssessment: ["approve", "export", "reject"],
      residentResource: ["approve", "export", "reject"],
    },
  },
  {
    role: "ilmiy_rahbar",
    reason: "`resident` da APPROVE/REJECT gate yo'q (resident.routes.js: create/readAll/update/delete)",
    dropActions: {
      resident: ["approve", "reject"],
    },
  },
  {
    role: "klinik_ustoz",
    reason:
      "o'lik `approve`; TZ 4.5.5/4.5.1 bo'yicha yozish huquqi",
    dropActions: {
      resident: ["approve", "create", "update"],
      residentDailyLog: ["create", "update"],
      residentAttendance: ["approve"],
      residentAssessment: ["approve"],
      residentResource: ["approve"],
    },
  },
  {
    role: "kafedra_mudiri",
    reason: "o'lik amallar; `residentDailyLog` BO'LIMI qoladi",
    dropActions: {
      resident: ["approve", "export", "reject"],
      residentDailyLog: ["export", "reject"],
    },
  },
  {
    role: "rezident",
    reason: "`chat` da UPDATE marshruti yo'q (chat.routes.js: create/readAll/read/delete)",
    dropActions: {
      chat: ["update"],
    },
  },
];

function trimPermissions(permissions, step) {
  const after = [];
  const notes = [];
  let removed = 0;

  for (const entry of permissions || []) {
    const section = entry.section;

    if (step.dropSections?.includes(section)) {
      notes.push(`bo'lim OLINDI: ${section} (${(entry.actionKeys || []).join(", ")})`);
      removed += (entry.actionKeys || []).length;
      continue;
    }

    const drop = step.dropActions?.[section];
    if (!drop) {
      after.push(entry);
      continue;
    }

    const kept = (entry.actionKeys || []).filter((a) => !drop.includes(a));
    const gone = (entry.actionKeys || []).filter((a) => drop.includes(a));
    if (!gone.length) {
      after.push(entry);
      continue;
    }
    notes.push(`${section}: -${gone.join(", -")}  (qoldi: ${kept.join(", ") || "—"})`);
    removed += gone.length;
    if (kept.length) after.push({ ...entry, actionKeys: kept });
  }

  return { after, notes, removed };
}

async function run() {
  const uri = process.env.MONGO_HOST;
  if (!uri) {
    log("  🔴 MONGO_HOST topilmadi — skript ISHGA TUSHMADI");
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(uri);
  const roles = mongoose.connection.collection("roles");

  log(`  Rejim: ${WRITE ? "--write (YOZADI)" : "dry-run (hech narsa yozilmaydi)"}`);
  log(`  Baza:  ${mongoose.connection.name}\n`);

  let changedRoles = 0;
  let removed = 0;

  for (const step of PLAN) {
    const doc = await roles.findOne({ title: step.role });
    if (!doc) {
      log(`  ⏭  ${step.role} — rol topilmadi`);
      continue;
    }

    const { after, notes, removed: dropped } = trimPermissions(doc.permissions, step);
    removed += dropped;

    if (!notes.length) {
      log(`  ✅ ${step.role} — allaqachon toza`);
      continue;
    }

    changedRoles += 1;
    log(`  ${step.role}  (${step.reason})`);
    for (const note of notes) log(`      · ${note}`);

    if (WRITE) {
      await roles.updateOne({ _id: doc._id }, { $set: { permissions: after } });
    }
  }

  log(`\n  O'zgargan rol: ${changedRoles} · olib tashlangan amal: ${removed}`);
  if (!WRITE && changedRoles) log("  ℹ️  Dry-run — yozish uchun `--write` bering");
  if (WRITE && changedRoles) log("  ✅ Yozildi");

  await mongoose.disconnect();
}

if (require.main === module) {
  run().catch((err) => {
    log(`  🔴 XATO: ${err.message}`);
    process.exitCode = 1;
  });
}

module.exports = { PLAN, WRITE_ACTIONS, trimPermissions };
