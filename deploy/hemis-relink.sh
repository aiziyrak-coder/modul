#!/bin/bash
# HEMIS kunlik sinxronidan (04:30) keyin: yangi xodim hisoblari, bo'lim/lavozim, yuz izlari, talaba/guruh/yo'nalish, ma'lumotnomalar. Idempotent.
set -eu
cd ~/modul
C="docker compose -f docker-compose.prod.yml"
echo "$(date -u +%FT%TZ) hemis-relink"
$C exec -T api node scripts/import-hemis-staff.js --apply | tail -2
$C exec -T api node scripts/link-departments.js --apply | tail -3
$C exec -T api node scripts/link-positions.js --apply | tail -3
$C exec -T api node scripts/enroll-hemis-photos.js --apply | tail -2
$C exec -T api node scripts/import-students.js --apply | tail -2
$C exec -T api node scripts/seed-hemis-references.js --apply | tail -2
