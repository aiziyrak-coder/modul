#!/usr/bin/env node
"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const { ROLES } = require("../src/config/constants");

const WRITE = process.argv.includes("--write");

const CANONICAL_DESC = /^TT 4\.(12|10)\./;
const DEMO_DESC = / — milliy reyting mezoni$/;

const pick = (arr, i) => arr[i % arr.length];

const FOREIGN_OTM = [
  "Karolinska Institutet",
  "Charité — Universitätsmedizin Berlin",
  "Seul milliy universiteti",
  "Hacettepe universiteti",
];
const COUNTRIES = ["Shvetsiya", "Germaniya", "Janubiy Koreya", "Turkiya"];
const SPECIALTIES = [
  "14.00.05 — Ichki kasalliklar",
  "14.00.09 — Pediatriya",
  "14.00.21 — Stomatologiya",
  "14.00.27 — Xirurgiya",
];
const JOURNALS = [
  "BMC Public Health",
  "Journal of Clinical Medicine",
  "Frontiers in Medicine",
  "International Journal of Environmental Research",
];
const ARTICLE_TITLES = [
  "Farg'ona vodiysida qandli diabet tarqalishi tahlili",
  "Bolalarda o'tkir respirator infeksiyalar profilaktikasi",
  "Parodont kasalliklarining erta diagnostikasi",
  "Jarrohlikdan keyingi asoratlarni kamaytirish usullari",
];
const DISSERTATION_TOPICS = [
  "Surunkali yurak yetishmovchiligini erta aniqlash mezonlari",
  "Chaqaloqlarda gipoksik-ishemik ensefalopatiya profilaktikasi",
  "Implantatsiyadan keyingi suyak regeneratsiyasi",
  "Laparoskopik jarrohlikda asoratlar prognozi",
];
const ACTIVITIES = [
  "Klinik epidemiologiya bo'yicha malaka oshirish kursi",
  "Ta'lim texnologiyalari bo'yicha seminar-trening",
  "Qiyosiy tibbiyot bo'yicha ma'ruzalar sikli",
  "Simulyatsion ta'lim bo'yicha amaliy kurs",
];
const GRANTS = [
  "Horizon Europe — sog'liqni saqlash tadqiqotlari",
  "Erasmus+ Capacity Building loyihasi",
  "KOICA tibbiy ta'lim granti",
  "TÜBİTAK qo'shma tadqiqot granti",
];
const DURATIONS = ["2 hafta", "1 oy", "3 oy", "6 oy"];

function demoValue(fieldName, fieldType, i) {
  switch (fieldName) {
    case "otmName":
    case "foreignOtm":
      return pick(FOREIGN_OTM, i);
    case "country":
      return pick(COUNTRIES, i);
    case "specialty":
      return pick(SPECIALTIES, i);
    case "specialtyCode":
      return pick(["14.00.05", "14.00.09", "14.00.21", "14.00.27"], i);
    case "journalName":
      return pick(JOURNALS, i);
    case "articleTitle":
    case "thesisTitle":
    case "topic":
      return pick(ARTICLE_TITLES, i);
    case "dissertationTopic":
      return pick(DISSERTATION_TOPICS, i);
    case "activityName":
      return pick(ACTIVITIES, i);
    case "grantName":
    case "grantTopic":
      return pick(GRANTS, i);
    case "duration":
      return pick(DURATIONS, i);
    case "publishYear":
      return pick(["2025", "2026"], i);
    case "pages":
      return pick(["45–52", "118–126", "7–14", "233–241"], i);
    case "citationCount":
      return pick([12, 27, 8, 41], i);
    case "authorsCount":
      return pick([1, 2, 3, 1], i);
    case "currentYearAmount":
      return pick([120_000_000, 85_000_000, 210_000_000, 64_000_000], i);
    case "totalAmount":
      return pick([340_000_000, 150_000_000, 500_000_000, 220_000_000], i);
    case "participationType":
      return pick(["Oflayn", "Onlayn"], i);
    case "basisType":
      return pick(["Buyruq", "Shartnoma", "Qaror"], i);
    case "googleScholarUrl":
      return "https://scholar.google.com/citations?user=demo";
    case "scopusUrl":
      return "https://www.scopus.com/authid/detail.uri?authorId=demo";
    case "url":
      return "https://doi.org/10.1000/demo";
    default:
      break;
  }
  switch (fieldType) {
    case "number":
      return pick([1, 2, 3, 5], i);
    case "date":
      return pick(["2026-02-14", "2025-11-03", "2026-04-22", "2025-09-30"], i);
    case "url":
      return "https://example.org/demo";
    case "file":
      return `${fieldName}_demo.pdf`;
    case "textarea":
      return "Demo ma'lumot — rol qo'llanmasi uchun.";
    default:
      return "Demo qiymat";
  }
}

function buildData(dataFields, i) {
  const skip = new Set();
  const has = (n) => dataFields.some((f) => f.fieldName === n);
  if (has("phdSeries") && has("dscSeries")) {
    (i % 2 === 0 ? ["dscSeries", "dscNumber"] : ["phdSeries", "phdNumber"]).forEach((n) =>
      skip.add(n),
    );
  }
  if (has("doctorDiplomaSeries") && has("professorDiplomaSeries")) {
    (i % 2 === 0
      ? ["professorDiplomaSeries", "professorDiplomaNumber"]
      : ["doctorDiplomaSeries", "doctorDiplomaNumber"]
    ).forEach((n) => skip.add(n));
  }

  const data = {};
  for (const f of dataFields) {
    if (skip.has(f.fieldName)) continue;
    if (f.fieldName.endsWith("Series")) {
      data[f.fieldName] = pick(["AA", "AB", "BC", "CD"], i);
    } else if (f.fieldName.endsWith("Number")) {
      data[f.fieldName] = String(1_240_000 + i * 137);
    } else {
      data[f.fieldName] = demoValue(f.fieldName, f.fieldType, i);
    }
  }
  return data;
}

const log = (s = "") => process.stdout.write(`${s}\n`);

(async () => {
  if (!process.env.MONGO_HOST) throw new Error("MONGO_HOST topilmadi (.env)");
  await mongoose.connect(process.env.MONGO_HOST);
  log(`[Dedupe] ${WRITE ? "WRITE" : "DRY-RUN"}`);
  log("");

  const indicators = mongoose.connection.db.collection("indicators");
  const submissions = mongoose.connection.db.collection("indicatorsubmissions");
  const roles = mongoose.connection.db.collection("roles");
  const users = mongoose.connection.db.collection("users");

  const all = await indicators.find({}).toArray();
  const canonical = all.filter(
    (x) => CANONICAL_DESC.test(x.desc || "") && (x.dataFields || []).length > 0,
  );
  const demo = all.filter(
    (x) => DEMO_DESC.test(x.desc || "") && (x.dataFields || []).length === 0,
  );

  log(`  Kanonik indikator : ${canonical.length}`);
  log(`  Dublikat (demo)   : ${demo.length}`);

  const byOrder = new Map(canonical.map((c) => [c.order, c]));
  const pairs = [];
  for (const d of demo) {
    const c = byOrder.get(d.order);
    if (!c) {
      log(`  ✖ TO'XTADI: dublikat "${d.title.slice(0, 45)}" (order ${d.order}) uchun kanonik topilmadi`);
      await mongoose.disconnect();
      process.exit(1);
    }
    pairs.push({ demo: d, canonical: c });
  }

  if (pairs.length) {
    log("");
    log("  Juftlar (dublikat -> kanonik):");
    for (const p of pairs) {
      const n = await submissions.countDocuments({ indicator: p.demo._id });
      log(
        `    order ${String(p.demo.order).padEnd(2)} koef ${String(p.demo.coefficient).padEnd(3)}` +
          ` -> koef ${String(p.canonical.coefficient).padEnd(3)} · ${n} yuborilma · ${p.canonical.title.slice(0, 42)}`,
      );
    }
  }

  const movedTo = new Map();
  for (const p of pairs) {
    const docs = await submissions.find({ indicator: p.demo._id }).toArray();
    for (const s of docs) {
      if (WRITE) {
        await submissions.updateOne(
          { _id: s._id },
          { $set: { indicator: p.canonical._id } },
        );
      }
      movedTo.set(String(s._id), p.canonical._id);
    }
  }
  log("");
  log(`  Ko'chirilgan yuborilma: ${movedTo.size}`);

  const qaRole = await roles.findOne({ title: ROLES.TALIM_SIFATI_NAZORATI });
  const qaUser = qaRole ? await users.findOne({ role: qaRole._id, active: true }) : null;

  const fieldsById = new Map(canonical.map((c) => [String(c._id), c.dataFields || []]));
  const coefById = new Map(canonical.map((c) => [String(c._id), c.coefficient]));
  const canonicalIds = new Set(canonical.map((c) => String(c._id)));
  const targets = (await submissions.find({}).sort({ _id: 1 }).toArray())
    .map((s) => ({ s, indicatorId: movedTo.get(String(s._id)) ?? s.indicator }))
    .filter(({ indicatorId }) => canonicalIds.has(String(indicatorId)));

  let rescored = 0;
  let filled = 0;
  let semestered = 0;
  let reviewed = 0;
  for (let i = 0; i < targets.length; i += 1) {
    const { s, indicatorId } = targets[i];
    const set = {};

    const coefficient = coefById.get(String(indicatorId)) || 0;
    const share = typeof s.authorShare === "number" ? s.authorShare : 100;
    const wantScore = s.status === "approved" ? coefficient * (share / 100) : 0;
    if ((s.score ?? 0) !== wantScore || s.authorShare !== share) {
      set.score = wantScore;
      set.authorShare = share;
      rescored += 1;
    }

    const fields = fieldsById.get(String(indicatorId)) || [];
    if (fields.length && (!s.data || Object.keys(s.data).length === 0)) {
      set.data = buildData(fields, i);
      filled += 1;
    }
    if (s.semester == null) {
      set.semester = (i % 2) + 1;
      semestered += 1;
    }
    if (
      s.status === "approved" &&
      !s.reviewedBy &&
      qaUser &&
      String(qaUser._id) !== String(s.teacher)
    ) {
      set.reviewedBy = qaUser._id;
      set.comment = "Hujjatlar to'liq, tasdiqlandi.";
      reviewed += 1;
    }

    if (Object.keys(set).length && WRITE) {
      await submissions.updateOne({ _id: s._id }, { $set: set });
    }
  }
  log(`  ball qayta hisoblandi : ${rescored}`);
  log(`  data to'ldirildi      : ${filled}`);
  log(`  semester to'ldirildi  : ${semestered}`);
  log(`  reviewedBy to'ldirildi: ${reviewed}`);

  let deleted = 0;
  for (const p of pairs) {
    const left = await submissions.countDocuments({ indicator: p.demo._id });
    if (left > 0 && WRITE) {
      log(`  ✖ TO'XTADI: "${p.demo.title.slice(0, 40)}" da hali ${left} yuborilma bor — o'chirilmadi`);
      continue;
    }
    if (WRITE) await indicators.deleteOne({ _id: p.demo._id });
    deleted += 1;
  }
  log(`  O'chirilgan dublikat  : ${deleted}`);

  log("");
  if (!WRITE) {
    log("  DRY-RUN — hech narsa yozilmadi. Qo'llash uchun: --write");
  } else {
    log(`  TAYYOR — indikator: ${await indicators.countDocuments({})}, ` +
        `yuborilma: ${await submissions.countDocuments({})}`);
  }

  await mongoose.disconnect();
})().catch((err) => {
  process.stderr.write(`[Dedupe] XATO: ${err.stack}\n`);
  process.exit(1);
});
