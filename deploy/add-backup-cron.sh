#!/bin/bash
# Kunlik zaxirani umumiy crontab'ga QO'SHADI (mavjudlarga tegmaydi). 01:30 — mavjud 02:15/03:00/03:15 dan oldin.
set -eu
LINE='30 1 * * * /home/admin_root/modul/deploy/backup.sh >> /home/admin_root/modul/backup.log 2>&1'
crontab -l > ~/crontab-$(date +%F-%H%M).bak
if crontab -l | grep -qF "modul/deploy/backup.sh"; then echo "cron allaqachon bor"; exit 0; fi
{ crontab -l; echo "$LINE"; } | crontab -
echo "qo'shildi. Vazifalar soni: $(crontab -l | grep -vc '^#')"
