// O'qituvchi lavozimlariga auditoriya soati me'yorlarini qo'llash (manba: DEPLOY.md va seed/references.seed.js §13/§18):
// professor 300 · dotsent 350 · katta o'qituvchi 380 · assistent 400 · stajer-o'qituvchi 400 (trainee = assistent).
//   node scripts/set-position-norms.js          -> quruq yurish
//   node scripts/set-position-norms.js --apply  -> yozadi
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");
const key = (s) => String(s || "").replace(/[‘’ʻʼ`´]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();

const NORMS = [
  { title: "Professor", min: 300, max: 600 },
  { title: "Dotsent", min: 350, max: 700 },
  { title: "Katta o'qituvchi", min: 380, max: 760 },
  { title: "Assistent", min: 400, max: 800 },
  { title: "Stajer-o'qituvchi", min: 400, max: 800 },
];

(async () => {
  await mongoose.connect(process.env.MONGO_HOST, { autoIndex: false, autoCreate: false });
  const Position = require("../src/references/position/position.model");
  const all = await Position.find({}).select("title minAuditoriumHours maxAuditoriumHours annualHours").lean();
  console.log(APPLY ? "== YOZISH ==" : "== QURUQ YURISH ==");
  for (const n of NORMS) {
    const p = all.find((x) => key(x.title) === key(n.title));
    if (!p) { console.log(`  ? ${n.title}: lavozim bazada yo'q`); continue; }
    console.log(`  ${p.title}: ${p.minAuditoriumHours}-${p.maxAuditoriumHours} -> ${n.min}-${n.max} (yillik ${p.annualHours})`);
    if (APPLY) {
      await Position.updateOne({ _id: p._id }, { $set: { minAuditoriumHours: n.min, maxAuditoriumHours: n.max } });
    }
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
