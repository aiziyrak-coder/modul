#!/bin/bash
# Faqat tuzilma: kamera bazasidagi students_staff USTUN NOMLARI va bizning rol nomlari. Hech kimning ma'lumoti chiqmaydi.
echo "== cam.fermi.uz: students_staff ustunlari =="
docker exec camera-api-db-1 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "select column_name from information_schema.columns where table_name = '"'"'students_staff'"'"' order by ordinal_position"' | tr '\n' ' '
echo; echo
echo "== cam.fermi.uz: sonlar (xodim, yuzi tasdiqlangan) =="
docker exec camera-api-db-1 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "select type, biometrics_status, count(*) from students_staff group by 1,2 order by 1,2"'
echo
echo "== bizning rollar =="
cat > /tmp/roles.js <<'JS'
db.roles.find({}, {title: 1, _id: 0}).sort({title: 1}).forEach(function (r) { print(r.title); });
JS
cd ~/modul && docker compose -f docker-compose.prod.yml exec -T mongo mongo --quiet institute-ais < /tmp/roles.js | tr '\n' ' '
rm -f /tmp/roles.js; echo
