#!/bin/bash
# Oxirgi zaxirani VAQTINCHALIK "restore_test" bazasiga tiklab, haqiqiy baza bilan solishtiradi, so'ng o'chiradi.
set -eu
cd ~/modul
C="docker compose -f docker-compose.prod.yml"
F=$(ls -t ~/modul/backups/institute-ais-*.archive.gz | head -1)
echo "zaxira: $(basename "$F")"
$C exec -T mongo mongorestore --archive --gzip --drop --nsFrom 'institute-ais.*' --nsTo "restore_test.*" < "$F" >/tmp/restore.log 2>&1 || { tail -5 /tmp/restore.log; exit 1; }
cat > /tmp/rt.js <<'JS'
var a = db.getSiblingDB("institute-ais"), b = db.getSiblingDB("restore_test");
["users","roles","students","groups","departments","faculties","positions","hemisrecords","facelinks","facetemplates"].forEach(function (c) {
  var x = a.getCollection(c).count(), y = b.getCollection(c).count();
  print((x === y ? "OK   " : "FARQ ") + c + ": asl=" + x + " tiklangan=" + y);
});
b.dropDatabase();
print("restore_test bazasi o'chirildi");
JS
$C exec -T mongo mongo --quiet < /tmp/rt.js
rm -f /tmp/rt.js
