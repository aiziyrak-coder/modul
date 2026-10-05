#!/bin/bash
# HEMIS xodim suratlari: nechtasida bor, manzil shakli, ochiladimi (shaxsiy ma'lumot chiqmaydi)
cd ~/modul
cat > /tmp/ph.js <<'JS'
var d = db.getSiblingDB("institute-ais");
var t = 0, withImg = 0, withFull = 0, sample = null;
d.hemisrecords.find({type: "employee", missing: false}).forEach(function (r) {
  t++; if (r.data.image) withImg++; if (r.data.image_full) { withFull++; if (!sample) sample = r.data.image_full; }
});
print("xodim qatori=" + t + " image bor=" + withImg + " image_full bor=" + withFull);
print("manzil shakli: " + (sample || "").replace(/[0-9a-f]{16,}/g, "<id>").replace(/[0-9]{3,}/g, "<n>"));
print("URL:" + sample);
JS
OUT=$(docker compose -f docker-compose.prod.yml exec -T mongo mongo --quiet < /tmp/ph.js)
rm -f /tmp/ph.js
echo "$OUT" | grep -v "^URL:"
URL=$(echo "$OUT" | grep "^URL:" | sed 's/^URL://')
[ -n "$URL" ] && curl -s -o /tmp/ph.bin -m 20 -w "namuna surat: HTTP %{http_code}, %{size_download} bayt, tur %{content_type}\n" "$URL"
rm -f /tmp/ph.bin
