#!/bin/bash
# Soatlik yuz sinxronini umumiy crontab'ga QO'SHADI (mavjud vazifalarga tegmaydi, almashtirmaydi).
set -eu
LINE='47 * * * * /home/admin_root/modul/deploy/face-sync.sh >> /home/admin_root/modul/face-sync.log 2>&1'
crontab -l > ~/crontab-$(date +%F-%H%M).bak
if crontab -l | grep -qF "modul/deploy/face-sync.sh"; then echo "cron allaqachon bor"; exit 0; fi
{ crontab -l; echo "$LINE"; } | crontab -
echo "qo'shildi. Hozirgi vazifalar soni: $(crontab -l | grep -vc '^#')"
