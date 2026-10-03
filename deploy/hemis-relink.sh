#!/bin/bash
# HEMIS kunlik sinxronidan (04:30) keyin: talaba/guruh/yo'nalish va yangi lavozimlarni yangilash. Idempotent.
set -eu
cd ~/modul
C="docker compose -f docker-compose.prod.yml"
echo "$(date -u +%FT%TZ) hemis-relink"
$C exec -T api node scripts/link-positions.js --apply | tail -3
$C exec -T api node scripts/import-students.js --apply | tail -2
