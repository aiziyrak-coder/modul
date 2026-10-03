#!/bin/bash
cd ~/modul
cat > /tmp/gs.js <<'JS'
var d = db.getSiblingDB("institute-ais");
var g = d.hemisrecords.findOne({type: "group"}).data, sp = d.hemisrecords.findOne({type: "specialty"}).data;
print("group keys: " + JSON.stringify(Object.keys(g)) + " | specialty.department: " + JSON.stringify(sp.department && Object.keys(sp.department)) + " | educationType: " + JSON.stringify(sp.educationType));
var langs = {}; d.hemisrecords.find({type: "group", missing: false}).forEach(function (r) { var k = JSON.stringify(r.data.educationLang); langs[k] = (langs[k] || 0) + 1; });
print("tillar: " + JSON.stringify(langs));
print("langs coll: " + d.languageofinstructions.count() + " directions: " + d.directions.count() + " groups: " + d.groups.count() + " students: " + d.students.count() + " courses: " + d.courses.count());
JS
docker compose -f docker-compose.prod.yml exec -T mongo mongo --quiet < /tmp/gs.js
rm -f /tmp/gs.js
