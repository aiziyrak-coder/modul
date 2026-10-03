#!/bin/bash
# HEMIS xodim yozuvlarida JSHSHIR (14 xonali raqam) bormi — faqat SONLAR chiqadi, ma'lumot emas.
cd ~/modul
cat > /tmp/pincheck.js <<'JS'
var t = 0, p = 0, e = 0;
db.hemisrecords.find({ type: "employee" }).forEach(function (r) {
  t++;
  if (/[0-9]{14}/.test(JSON.stringify(r.data))) p++;
  if (r.data.employee_id_number) e++;
});
print("xodim qatori: " + t + " | 14 xonali raqami borlari: " + p + " | employee_id_number borlari: " + e);
print("lavozimlar (eng ko'p 15):");
db.hemisrecords.aggregate([
  { $match: { type: "employee" } },
  { $group: { _id: "$data.staffPosition.name", n: { $sum: 1 } } },
  { $sort: { n: -1 } }, { $limit: 15 }
]).forEach(function (d) { print("  " + d.n + "  " + d._id); });
print("hozirgi foydalanuvchilar: " + db.users.count() + ", rollar: " + db.roles.count());
JS
docker compose -f docker-compose.prod.yml exec -T mongo mongo --quiet institute-ais < /tmp/pincheck.js
rm -f /tmp/pincheck.js
