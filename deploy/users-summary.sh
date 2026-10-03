#!/bin/bash
cd ~/modul
cat > /tmp/us.js <<'JS'
var d = db.getSiblingDB("institute-ais");
print("foydalanuvchi=" + d.users.count() + " rolsiz=" + d.users.count({role: null}) + " bolimsiz(kafedra/fakultet/bolim yo'q)=" + d.users.count({department: null, faculty: null, division: null}) + " lavozimsiz=" + d.users.count({position: null}));
print("yuz bilan bog'langan hisob=" + d.facetemplates.count({kind: "xodim", user: {$ne: null}, active: true}) + " | bog'lanmagan xodim yuzi=" + d.facetemplates.count({kind: "xodim", user: null, active: true}) + " | raqib talaba yuzi=" + d.facetemplates.count({kind: "talaba", active: true}));
JS
docker compose -f docker-compose.prod.yml exec -T mongo mongo --quiet < /tmp/us.js
rm -f /tmp/us.js
