#!/bin/bash
# Bitta xodim surati manzilini turli usulda tekshirish (faqat HTTP kodlari)
cd ~/modul
cat > /tmp/pp.js <<'JS'
var d = db.getSiblingDB("institute-ais");
var r = d.hemisrecords.findOne({type: "employee", "data.image_full": {$ne: null}}).data;
print("IMG:" + r.image); print("FULL:" + r.image_full);
JS
OUT=$(docker compose -f docker-compose.prod.yml exec -T mongo mongo --quiet < /tmp/pp.js); rm -f /tmp/pp.js
IMG=$(echo "$OUT" | sed -n 's/^IMG://p'); FULL=$(echo "$OUT" | sed -n 's/^FULL://p')
TOKEN=$(grep '^HEMIS_API_TOKEN=' env/main.env | cut -d= -f2-)
t() { curl -s -o /tmp/pb -m 20 -w "$1 -> HTTP %{http_code} %{content_type} %{size_download}b\n" ${@:2}; }
t "image (tokensiz)" "$IMG"
t "image_full (tokensiz)" "$FULL"
t "image_full (Bearer)" -H "Authorization: Bearer $TOKEN" "$FULL"
t "image_full http" "${FULL/https:/http:}"
H=$(echo "$FULL" | sed 's#https\?://\([^/]*\)/.*#\1#'); echo "surat hosti: $H"
t "student.fjsti.uz host bilan" "$(echo "$FULL" | sed 's#//[^/]*/#//student.fjsti.uz/#')"
rm -f /tmp/pb
