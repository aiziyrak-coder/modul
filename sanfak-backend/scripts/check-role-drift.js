"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { ROLES } = require("../src/config/constants");
const { loadAll } = require("../seed/_role-seed-inventory");

function check() {
  const canonical = new Set(Object.values(ROLES));
  const { titles } = loadAll();
  const unknown = [...titles].filter((t) => !canonical.has(t)).sort();
  return { unknown, scannedTitleCount: titles.size, canonicalCount: canonical.size };
}

function printReport({ unknown, scannedTitleCount, canonicalCount }) {
  const line = (s = "") => console.log(s);
  line("═══════════════════════════════════════════════════════════════");
  line(" seed/*.seed.js rol nomlari  ↔  constants.ROLES");
  line("═══════════════════════════════════════════════════════════════");
  line(`  Skanerlangan noyob rol nomi: ${scannedTitleCount}`);
  line(`  constants.ROLES kanonik soni: ${canonicalCount}`);
  line(`  constants.ROLES da YO'Q (drift): ${unknown.length}`);
  unknown.forEach((t) => line(`    ✗ "${t}"`));
  line("═══════════════════════════════════════════════════════════════");
  if (unknown.length) {
    line(`\n❌ ${unknown.length} ta rol nomi constants.ROLES da yo'q — qo'shish kerak (add-only).`);
  } else {
    line("\n✅ Rol-nomi drifti yo'q — skanerlangan barcha rol constants.ROLES da bor.");
  }
}

if (require.main === module) {
  const result = check();
  printReport(result);
  process.exit(result.unknown.length > 0 ? 1 : 0);
}

module.exports = { check };
