#!/bin/bash
set -eu
LINE='10 5 * * * /home/admin_root/modul/deploy/hemis-relink.sh >> /home/admin_root/modul/hemis-relink.log 2>&1'
crontab -l > ~/crontab-$(date +%F-%H%M).bak
if crontab -l | grep -qF "modul/deploy/hemis-relink.sh"; then echo "cron allaqachon bor"; exit 0; fi
{ crontab -l; echo "$LINE"; } | crontab -
echo "qo'shildi: $(crontab -l | grep -vc "^#") vazifa"
