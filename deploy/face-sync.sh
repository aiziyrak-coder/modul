#!/bin/bash
# cam.fermi.uz tasdiqlangan yuzlarini (xodim + talaba) o'qib, bizning bazaga nusxalash. Kameradan FAQAT O'QILADI.
# Cron (har soat; mavjud cron'larga QO'SHILADI, almashtirilmaydi):
#   47 * * * * /home/admin_root/modul/deploy/face-sync.sh >> /home/admin_root/modul/face-sync.log 2>&1
set -eu
TMP=$(mktemp); chmod 600 "$TMP"; trap 'rm -f "$TMP"' EXIT
docker exec -i camera-api-db-1 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At -F "$1"' _ "$(printf '\t')" > "$TMP" <<'SQL'
select id, type, biometric_embedding
from students_staff
where type in ('xodim', 'talaba') and biometrics_status = 'tasdiqlangan' and biometric_embedding is not null;
SQL
printf '%s ' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cd ~/modul
docker compose -f docker-compose.prod.yml exec -T api node scripts/sync-face-templates.js "$@" < "$TMP"
