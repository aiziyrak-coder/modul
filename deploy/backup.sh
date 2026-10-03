#!/bin/bash
# Kunlik zaxira: MongoDB (institute-ais, listener-db) + yuklangan fayllar. 7 kun saqlanadi.
# Boshqa loyihalarga tegmaydi; faqat ~/modul/backups ga yozadi.
set -eu
cd ~/modul
C="docker compose -f docker-compose.prod.yml"
DIR=~/modul/backups
STAMP=$(date +%Y%m%d-%H%M)
mkdir -p "$DIR"; chmod 700 "$DIR"

$C exec -T mongo mongodump --quiet --archive --gzip --db institute-ais > "$DIR/institute-ais-$STAMP.archive.gz"
$C exec -T mongo mongodump --quiet --archive --gzip --db listener-db > "$DIR/listener-db-$STAMP.archive.gz"
$C exec -T api tar czf - -C /app uploads private 2>/dev/null > "$DIR/files-$STAMP.tar.gz" || true

# asosiy baza zaxirasi bo'sh/buzilgan bo'lsa xato deb to'xtaymiz (eskilarni o'chirmaymiz)
[ "$(stat -c %s "$DIR/institute-ais-$STAMP.archive.gz")" -gt 100000 ] || { echo "XATO: asosiy baza zaxirasi juda kichik"; exit 1; }
[ "$(stat -c %s "$DIR/listener-db-$STAMP.archive.gz")" -gt 20 ] || { echo "XATO: listener-db zaxirasi bo'sh"; exit 1; }
find "$DIR" -type f -name '*-2*' -mtime +7 -delete
echo "$(date -u +%FT%TZ) OK $(du -sh "$DIR" | cut -f1) ($(ls "$DIR" | wc -l) fayl)"
