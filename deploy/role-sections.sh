#!/bin/bash
# Bir rolning ayrim bo'limlari (sozlama): bash role-sections.sh oqituvchi notification announcement chat dashboard auth
ROLE="$1"; shift
cd ~/modul
{ echo "var d=db.getSiblingDB('institute-ais');var r=d.roles.findOne({title:'$ROLE'});var want=[$(printf "'%s'," "$@")];"
  echo "r.permissions.forEach(function(p){ if(want.indexOf(p.section)>=0) print(p.section+': '+p.actionKeys.join(',')); });"; } > /tmp/rs.js
docker compose -f docker-compose.prod.yml exec -T mongo mongo --quiet < /tmp/rs.js
rm -f /tmp/rs.js
