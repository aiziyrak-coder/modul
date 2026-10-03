#!/bin/bash
# Rollar ro'yxati: nom, doira, bo'limlar soni (faqat sozlama, shaxsiy ma'lumot emas)
cd ~/modul
cat > /tmp/r.js <<'JS'
var d = db.getSiblingDB("institute-ais");
d.roles.find({}).sort({title: 1}).forEach(function (r) {
  var secs = r.permissions.map(function (p) { return p.section; });
  print(r.title + " | doira=" + r.scopeLevel + " | bolimlar=" + secs.length + " | " + secs.slice(0, 7).join(","));
});
JS
docker compose -f docker-compose.prod.yml exec -T mongo mongo --quiet < /tmp/r.js
rm -f /tmp/r.js
