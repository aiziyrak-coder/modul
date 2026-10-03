#!/bin/bash
# HEMIS tuzilmasi: bo'limlar, turlari, ota-bo'lim; xodim soni. Faqat tuzilma, shaxsiy ma'lumot emas.
cd ~/modul
cat > /tmp/hs.js <<'JS'
var d = db.getSiblingDB("institute-ais");
var deps = d.hemisrecords.find({type: "department", missing: false}).toArray();
var cnt = {};
d.hemisrecords.find({type: "employee", missing: false}).forEach(function (r) {
  var k = r.data.department && (r.data.department.id || r.data.department.code);
  cnt[k] = (cnt[k] || 0) + 1;
});
var st = {};
deps.forEach(function (r) { var t = r.data.structureType && r.data.structureType.name; st[t] = (st[t] || 0) + 1; });
print("TURLAR: " + JSON.stringify(st));
print("namuna department maydonlari: " + JSON.stringify(Object.keys(deps[0].data)));
print("employee.department namunasi: " + JSON.stringify(d.hemisrecords.findOne({type: "employee"}).data.department));
deps.sort(function (a, b) { return (a.data.structureType.name + a.data.name) < (b.data.structureType.name + b.data.name) ? -1 : 1; });
deps.forEach(function (r) {
  var x = r.data;
  print([x.id, x.code, (x.structureType || {}).name, "ota=" + (x.parent || "-"), "xodim=" + (cnt[x.id] || cnt[x.code] || 0), x.active ? "faol" : "NOFAOL", x.name].join(" | "));
});
JS
docker compose -f docker-compose.prod.yml exec -T mongo mongo --quiet < /tmp/hs.js
rm -f /tmp/hs.js
