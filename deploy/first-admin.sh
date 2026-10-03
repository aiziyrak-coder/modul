#!/bin/bash
# Birinchi administrator. JSHSHIR yashirin so'raladi (ekranda, tarixda va ps'da ko'rinmaydi).
set -e
cd ~/modul
read -rp "Ism: " FN
read -rp "Familiya: " LN
read -rsp "JSHSHIR (14 raqam, ekranda ko'rinmaydi): " PIN; echo
printf '%s' "$PIN" | docker compose -f docker-compose.prod.yml exec -T api \
  node seed/first-admin.seed.js --pin-stdin --name "$FN $LN"
unset PIN
