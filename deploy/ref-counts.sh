#!/bin/bash
cd ~/modul
cat > /tmp/rc.js <<'JS'
var d = db.getSiblingDB("institute-ais");
["faculties","departments","divisions","positions"].forEach(function (c) { print(c + ": " + d.getCollection(c).count()); });
print("users: dept=" + d.users.count({department: {$ne: null}}) + " faculty=" + d.users.count({faculty: {$ne: null}}) + " division=" + d.users.count({division: {$ne: null}}));
JS
docker compose -f docker-compose.prod.yml exec -T mongo mongo --quiet < /tmp/rc.js
rm -f /tmp/rc.js
