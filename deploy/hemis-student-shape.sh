#!/bin/bash
# HEMIS talaba maydonlarining qiymatlar TAQSIMOTI (faqat sonlar, shaxsiy ma'lumot emas)
cd ~/modul
cat > /tmp/ss.js <<'JS'
var d = db.getSiblingDB("institute-ais");
function dist(path) {
  var out = {};
  d.hemisrecords.aggregate([{$match: {type: "student", missing: false}}, {$group: {_id: "$data." + path, n: {$sum: 1}}}, {$sort: {n: -1}}, {$limit: 12}]).forEach(function (x) { out[JSON.stringify(x._id)] = x.n; });
  print(path + ": " + JSON.stringify(out));
}
["gender.code","gender.name","studentStatus.name","level.name","level.code","semester.code","semester.name","paymentForm.name","educationForm.name","educationType.name","studentType.name","educationYear.name","year_of_enter","is_graduate"].forEach(dist);
var s = d.hemisrecords.findOne({type: "student"}).data;
print("birth_date turi: " + typeof s.birth_date + " | student_id_number turi: " + typeof s.student_id_number + " | specialty keys: " + JSON.stringify(Object.keys(s.specialty || {})) + " | group keys: " + JSON.stringify(Object.keys(s.group || {})) + " | department keys: " + JSON.stringify(Object.keys(s.department || {})));
print("talabalar guruhsiz: " + d.hemisrecords.count({type: "student", missing: false, "data.group": null}));
JS
docker compose -f docker-compose.prod.yml exec -T mongo mongo --quiet < /tmp/ss.js
rm -f /tmp/ss.js
