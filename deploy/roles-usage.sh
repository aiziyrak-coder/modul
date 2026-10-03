#!/bin/bash
# Rollar bo'yicha foydalanuvchi soni va lavozimlar bo'yicha taqsimot (faqat sonlar)
cd ~/modul
cat > /tmp/ru.js <<'JS'
var d = db.getSiblingDB("institute-ais");
var used = {};
d.users.aggregate([{$group: {_id: "$role", n: {$sum: 1}}}]).forEach(function (x) { used[String(x._id)] = x.n; });
var empty = [];
d.roles.find({}).sort({title: 1}).forEach(function (r) { if (!used[String(r._id)]) empty.push(r.title); });
print("BO'SH ROLLAR (" + empty.length + "): " + empty.join(", "));
print("--- lavozim | rol | soni");
d.users.aggregate([
  {$lookup: {from: "positions", localField: "position", foreignField: "_id", as: "p"}},
  {$lookup: {from: "roles", localField: "role", foreignField: "_id", as: "r"}},
  {$group: {_id: {p: {$arrayElemAt: ["$p.title", 0]}, r: {$arrayElemAt: ["$r.title", 0]}}, n: {$sum: 1}}},
  {$sort: {"_id.p": 1}}
]).forEach(function (x) { print((x._id.p || "(lavozimsiz)") + " | " + x._id.r + " | " + x.n); });
JS
docker compose -f docker-compose.prod.yml exec -T mongo mongo --quiet < /tmp/ru.js
rm -f /tmp/ru.js
