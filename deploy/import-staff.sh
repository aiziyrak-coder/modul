#!/bin/bash
# cam.fermi.uz xodimlari + HEMIS -> foydalanuvchilar.  Standart: QURUQ YURISH (faqat sonlar).
#   bash deploy/import-staff.sh           # quruq yurish
#   bash deploy/import-staff.sh --apply   # haqiqiy yozuv
# Kamera bazasidan FAQAT O'QILADI; yuz vektori (embedding) olinmaydi.
set -eu
TMP=$(mktemp); chmod 600 "$TMP"; trap 'rm -f "$TMP"' EXIT
docker exec -i camera-api-db-1 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At -F "$1"' _ "$(printf '\t')" > "$TMP" <<'SQL'
select id,
       regexp_replace(full_name, '[\t\r\n]+', ' ', 'g'),
       coalesce(pinfl, ''),
       coalesce(hemis_id::text, ''),
       regexp_replace(coalesce(position, group_or_position, ''), '[\t\r\n]+', ' ', 'g'),
       active,
       type
from students_staff
where type = 'xodim';
SQL
echo "kameradan olingan xodim qatorlari: $(wc -l < "$TMP")"
cd ~/modul
docker compose -f docker-compose.prod.yml exec -T api node scripts/import-staff.js "$@" < "$TMP"
