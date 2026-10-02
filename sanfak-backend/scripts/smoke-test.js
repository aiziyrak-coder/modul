const express = require("express");
const listEndpoints = require("express-list-endpoints");

const TOKEN = process.argv[2] || process.env.TOKEN;
const BASE = process.env.BASE || "http://localhost:4000/api";

if (!TOKEN) {
  console.error("❌ Token kerak:  node scripts/smoke-test.js <JWT_TOKEN>");
  process.exit(1);
}

const app = express();
app.use("/api", require("../src/router"));
const endpoints = listEndpoints(app);

const targets = [];
for (const ep of endpoints) {
  const rel = ep.path.replace(/^\/api/, "");
  if (rel.includes(":")) continue;
  if (ep.methods.includes("GET")) targets.push(rel);
}

(async () => {
  let ok = 0, auth = 0, forb = 0, other = 0, srv = 0;
  const problems = [];
  for (const path of targets) {
    try {
      const url = path.endsWith("/paginate")
        ? `${BASE}${path}?page=1&limit=10`
        : BASE + path;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      const s = res.status;
      if (s < 300) ok++;
      else if (s === 401) auth++;
      else if (s === 403) forb++;
      else if (s >= 500) { srv++; problems.push(`${s}  GET ${path}`); }
      else { other++; problems.push(`${s}  GET ${path}`); }
    } catch (e) {
      srv++;
      problems.push(`ERR  GET ${path} — ${e.message}`);
    }
  }

  console.log(`\n=== Smoke-test: ${targets.length} ta GET endpoint ===`);
  console.log(`  ✅ 2xx (ishlayapti)   : ${ok}`);
  console.log(`  🔐 401 (auth)         : ${auth}`);
  console.log(`  ⛔ 403 (ruxsat yo'q)  : ${forb}`);
  console.log(`  ⚠️  4xx (boshqa)      : ${other}`);
  console.log(`  💥 5xx (SERVER BUG)   : ${srv}`);
  if (problems.length) {
    console.log("\n--- Muammoli endpoint'lar (4xx-boshqa + 5xx) ---");
    problems.forEach((p) => console.log("  " + p));
  }
  process.exit(srv > 0 ? 1 : 0);
})();
